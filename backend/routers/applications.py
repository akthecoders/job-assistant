from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import json
from database import get_db

router = APIRouter(prefix="/api/applications", tags=["applications"])

VALID_STATUSES = {"saved", "applied", "interview", "offer", "rejected"}


class ApplicationCreate(BaseModel):
    job_title: str
    company: str
    job_url: Optional[str] = None
    job_description: Optional[str] = None
    status: str = "saved"
    resume_id: Optional[int] = None
    tailored_resume: Optional[str] = None
    cover_letter: Optional[str] = None
    ats_score: Optional[int] = None
    ats_details: Optional[dict] = None
    notes: Optional[str] = None
    applied_at: Optional[str] = None


class ApplicationUpdate(BaseModel):
    job_title: Optional[str] = None
    company: Optional[str] = None
    job_url: Optional[str] = None
    job_description: Optional[str] = None
    status: Optional[str] = None
    resume_id: Optional[int] = None
    tailored_resume: Optional[str] = None
    cover_letter: Optional[str] = None
    ats_score: Optional[int] = None
    ats_details: Optional[dict] = None
    notes: Optional[str] = None
    applied_at: Optional[str] = None


def _serialize(row: dict) -> dict:
    if row.get("ats_details") and isinstance(row["ats_details"], str):
        try:
            row["ats_details"] = json.loads(row["ats_details"])
        except Exception:
            pass
    return row


@router.get("")
async def list_applications(status: Optional[str] = None):
    async with get_db() as db:
        if status:
            async with db.execute(
                "SELECT * FROM applications WHERE status = ? ORDER BY created_at DESC",
                (status,),
            ) as cur:
                rows = await cur.fetchall()
        else:
            async with db.execute(
                "SELECT * FROM applications ORDER BY created_at DESC"
            ) as cur:
                rows = await cur.fetchall()
    return [_serialize(dict(r)) for r in rows]


@router.get("/{app_id}")
async def get_application(app_id: int):
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM applications WHERE id = ?", (app_id,)
        ) as cur:
            row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Application not found")
    return _serialize(dict(row))


@router.post("", status_code=201)
async def create_application(payload: ApplicationCreate):
    if payload.status not in VALID_STATUSES:
        raise HTTPException(400, f"status must be one of {VALID_STATUSES}")
    async with get_db() as db:
        ats_details = json.dumps(payload.ats_details) if payload.ats_details else None
        async with db.execute(
            """INSERT INTO applications
               (job_title, company, job_url, job_description, status, resume_id,
                tailored_resume, cover_letter, ats_score, ats_details, notes, applied_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id""",
            (
                payload.job_title, payload.company, payload.job_url,
                payload.job_description, payload.status, payload.resume_id,
                payload.tailored_resume, payload.cover_letter, payload.ats_score,
                ats_details, payload.notes, payload.applied_at,
            ),
        ) as cur:
            row = await cur.fetchone()
        await db.commit()
    return {"id": row[0]}


@router.put("/{app_id}")
async def update_application(app_id: int, payload: ApplicationUpdate):
    if payload.status and payload.status not in VALID_STATUSES:
        raise HTTPException(400, f"status must be one of {VALID_STATUSES}")
    async with get_db() as db:
        async with db.execute(
            "SELECT id FROM applications WHERE id = ?", (app_id,)
        ) as cur:
            if not await cur.fetchone():
                raise HTTPException(404, "Application not found")
        updates = payload.model_dump(exclude_none=True)
        if "ats_details" in updates and isinstance(updates["ats_details"], dict):
            updates["ats_details"] = json.dumps(updates["ats_details"])
        if updates:
            updates["updated_at"] = "datetime('now')"
            # Build SET clause manually to handle the datetime function
            set_parts = []
            values = []
            for k, v in updates.items():
                if k == "updated_at":
                    set_parts.append(f"{k} = datetime('now')")
                else:
                    set_parts.append(f"{k} = ?")
                    values.append(v)
            await db.execute(
                f"UPDATE applications SET {', '.join(set_parts)} WHERE id = ?",
                (*values, app_id),
            )
        await db.commit()
    return {"ok": True}


@router.delete("/{app_id}")
async def delete_application(app_id: int):
    async with get_db() as db:
        await db.execute("DELETE FROM applications WHERE id = ?", (app_id,))
        await db.commit()
    return {"ok": True}
