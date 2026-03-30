from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import json
from database import get_db

router = APIRouter(prefix="/api/autofill", tags=["autofill"])

PROFILE_KEYS = [
    "full_name", "email", "phone", "location",
    "linkedin_url", "portfolio_url", "github_url",
    "years_experience", "current_title", "current_company",
    "willing_to_relocate", "work_authorization",
    "desired_salary", "notice_period", "custom_fields",
]


class AutofillProfile(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    github_url: Optional[str] = None
    years_experience: Optional[int] = None
    current_title: Optional[str] = None
    current_company: Optional[str] = None
    willing_to_relocate: Optional[bool] = None
    work_authorization: Optional[str] = None
    desired_salary: Optional[str] = None
    notice_period: Optional[str] = None
    custom_fields: Optional[dict] = None


@router.get("/profile")
async def get_profile():
    """Return all autofill profile fields as a flat dict."""
    result: dict = {}
    async with get_db() as db:
        async with db.execute(
            "SELECT field_key, field_value FROM autofill_profile WHERE field_key IN ({})".format(
                ",".join("?" * len(PROFILE_KEYS))
            ),
            PROFILE_KEYS,
        ) as cur:
            rows = await cur.fetchall()

    for row in rows:
        key, raw = row["field_key"], row["field_value"]
        if key == "custom_fields":
            try:
                result[key] = json.loads(raw)
            except Exception:
                result[key] = raw
        elif key == "willing_to_relocate":
            result[key] = raw.lower() in ("1", "true") if raw else None
        elif key == "years_experience":
            try:
                result[key] = int(raw)
            except (TypeError, ValueError):
                result[key] = None
        else:
            result[key] = raw

    return result


@router.put("/profile")
async def save_profile(profile: AutofillProfile):
    """Upsert each autofill profile field into the key/value table."""
    data = profile.model_dump()

    # Serialize special types to strings for storage
    rows_to_upsert = []
    for key in PROFILE_KEYS:
        value = data.get(key)
        if value is None:
            continue
        if key == "custom_fields":
            str_value = json.dumps(value)
        elif key == "willing_to_relocate":
            str_value = "1" if value else "0"
        else:
            str_value = str(value)
        rows_to_upsert.append((key, str_value))

    async with get_db() as db:
        for field_key, field_value in rows_to_upsert:
            await db.execute(
                """
                INSERT INTO autofill_profile (field_key, field_value, updated_at)
                VALUES (?, ?, datetime('now'))
                ON CONFLICT(field_key) DO UPDATE SET
                  field_value = excluded.field_value,
                  updated_at  = excluded.updated_at
                """,
                (field_key, field_value),
            )
        await db.commit()

    return {"ok": True}
