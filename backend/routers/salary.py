import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import get_db
from services.ai_provider import AIProvider
from services.salary_intel import generate_salary_intel

router = APIRouter(prefix="/api/salary", tags=["salary"])


class SalaryRequest(BaseModel):
    offer_amount: Optional[int] = None
    location: Optional[str] = ""


@router.post("/{app_id}/generate")
async def generate(app_id: int, req: SalaryRequest):
    """Generate salary range + negotiation coaching for an application."""
    async with get_db() as db:
        async with db.execute(
            "SELECT job_title, company FROM applications WHERE id = ?", (app_id,)
        ) as cur:
            row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Application not found")

    async with get_db() as db:
        provider = await AIProvider.from_db(db)

    result = await generate_salary_intel(
        provider,
        row["job_title"],
        row["company"],
        req.location or "",
        req.offer_amount,
    )

    async with get_db() as db:
        # Delete existing salary data for this app and insert fresh
        await db.execute("DELETE FROM salary_data WHERE application_id = ?", (app_id,))
        await db.execute(
            """INSERT INTO salary_data
               (application_id, role_title, location, range_low, range_mid, range_high,
                negotiation_script, counterargument_prep, data_sources)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                app_id,
                row["job_title"],
                req.location or "",
                result.get("range_low", 0),
                result.get("range_mid", 0),
                result.get("range_high", 0),
                result.get("negotiation_script", ""),
                json.dumps(result.get("counterargument_prep", [])),
                json.dumps(result.get("data_sources", [])),
            )
        )
        await db.commit()

    return result


@router.get("/{app_id}")
async def get_salary(app_id: int):
    """Get cached salary data for an application."""
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM salary_data WHERE application_id = ? ORDER BY created_at DESC LIMIT 1",
            (app_id,)
        ) as cur:
            row = await cur.fetchone()

    if not row:
        return {"message": "No salary data yet — POST to /{app_id}/generate"}

    d = dict(row)
    for field in ["counterargument_prep", "data_sources"]:
        if d.get(field):
            try:
                d[field] = json.loads(d[field])
            except Exception:
                d[field] = []
    return d
