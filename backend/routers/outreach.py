from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import get_db
from services.ai_provider import AIProvider
from services.outreach_generator import generate_linkedin_message, generate_cold_email

router = APIRouter(prefix="/api/outreach", tags=["outreach"])


class OutreachRequest(BaseModel):
    outreach_type: str  # 'linkedin' | 'cold_email'
    contact_name: Optional[str] = ""
    contact_title: Optional[str] = ""


class OutreachUpdate(BaseModel):
    draft_text: str


@router.post("/{app_id}/generate")
async def generate_outreach(app_id: int, req: OutreachRequest):
    async with get_db() as db:
        async with db.execute(
            "SELECT job_title, company, resume_id FROM applications WHERE id = ?", (app_id,)
        ) as cur:
            row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Application not found")

    resume_snippet = ""
    if row["resume_id"]:
        async with get_db() as db:
            async with db.execute(
                "SELECT substr(content, 1, 400) as snippet FROM resumes WHERE id = ?",
                (row["resume_id"],)
            ) as cur:
                r = await cur.fetchone()
            if r:
                resume_snippet = r["snippet"]

    async with get_db() as db:
        provider = await AIProvider.from_db(db)

    if req.outreach_type == "linkedin":
        text = await generate_linkedin_message(
            provider, row["company"], row["job_title"],
            req.contact_name or "", req.contact_title or "", resume_snippet
        )
    else:
        result = await generate_cold_email(
            provider, row["company"], row["job_title"],
            req.contact_name or "", req.contact_title or "", resume_snippet
        )
        text = f"Subject: {result['subject']}\n\n{result['body']}"

    async with get_db() as db:
        async with db.execute(
            """INSERT INTO outreach_drafts (application_id, outreach_type, contact_name, contact_title, draft_text)
               VALUES (?, ?, ?, ?, ?) RETURNING id""",
            (app_id, req.outreach_type, req.contact_name, req.contact_title, text)
        ) as cur:
            new_row = await cur.fetchone()
        await db.commit()

    return {"id": new_row[0], "outreach_type": req.outreach_type, "draft_text": text}


@router.get("/{app_id}")
async def list_outreach(app_id: int):
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM outreach_drafts WHERE application_id = ? ORDER BY created_at DESC",
            (app_id,)
        ) as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]


@router.put("/{draft_id}")
async def update_outreach(draft_id: int, body: OutreachUpdate):
    async with get_db() as db:
        await db.execute(
            "UPDATE outreach_drafts SET draft_text = ? WHERE id = ?",
            (body.draft_text, draft_id)
        )
        await db.commit()
    return {"ok": True}


@router.delete("/{draft_id}")
async def delete_outreach(draft_id: int):
    async with get_db() as db:
        await db.execute("DELETE FROM outreach_drafts WHERE id = ?", (draft_id,))
        await db.commit()
    return {"ok": True}
