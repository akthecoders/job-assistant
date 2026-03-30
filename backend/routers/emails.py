from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import get_db
from services.ai_provider import AIProvider
from services.outreach_generator import generate_email_draft

router = APIRouter(prefix="/api/emails", tags=["emails"])

EMAIL_TYPES = ["cold_outreach", "followup_1w", "followup_2w", "thank_you", "negotiation"]
EMAIL_LABELS = {
    "cold_outreach": "Cold Outreach",
    "followup_1w": "Follow-up (1 week)",
    "followup_2w": "Follow-up (2 weeks)",
    "thank_you": "Thank You",
    "negotiation": "Negotiation",
}


class EmailRequest(BaseModel):
    email_type: str


class EmailUpdate(BaseModel):
    body: str
    subject: Optional[str] = None


@router.post("/{app_id}/generate")
async def generate_email(app_id: int, req: EmailRequest):
    if req.email_type not in EMAIL_TYPES:
        raise HTTPException(400, f"email_type must be one of: {EMAIL_TYPES}")

    async with get_db() as db:
        async with db.execute(
            "SELECT job_title, company FROM applications WHERE id = ?", (app_id,)
        ) as cur:
            row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Application not found")

    async with get_db() as db:
        provider = await AIProvider.from_db(db)

    draft = await generate_email_draft(
        provider, req.email_type, row["job_title"], row["company"]
    )

    async with get_db() as db:
        async with db.execute(
            """INSERT INTO email_drafts (application_id, email_type, subject, body)
               VALUES (?, ?, ?, ?) RETURNING id""",
            (app_id, req.email_type, draft["subject"], draft["body"])
        ) as cur:
            new_row = await cur.fetchone()
        await db.commit()

    return {
        "id": new_row[0],
        "email_type": req.email_type,
        "label": EMAIL_LABELS[req.email_type],
        "subject": draft["subject"],
        "body": draft["body"],
    }


@router.get("/{app_id}")
async def list_emails(app_id: int):
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM email_drafts WHERE application_id = ? ORDER BY created_at DESC",
            (app_id,)
        ) as cur:
            rows = await cur.fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["label"] = EMAIL_LABELS.get(d["email_type"], d["email_type"])
        result.append(d)
    return result


@router.put("/{draft_id}")
async def update_email(draft_id: int, body: EmailUpdate):
    async with get_db() as db:
        if body.subject:
            await db.execute(
                "UPDATE email_drafts SET body = ?, subject = ? WHERE id = ?",
                (body.body, body.subject, draft_id)
            )
        else:
            await db.execute(
                "UPDATE email_drafts SET body = ? WHERE id = ?",
                (body.body, draft_id)
            )
        await db.commit()
    return {"ok": True}


@router.delete("/{draft_id}")
async def delete_email(draft_id: int):
    async with get_db() as db:
        await db.execute("DELETE FROM email_drafts WHERE id = ?", (draft_id,))
        await db.commit()
    return {"ok": True}
