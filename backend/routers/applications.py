from fastapi import APIRouter, HTTPException, BackgroundTasks
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
    posted_at: Optional[str] = None
    board_signals: Optional[list[str]] = []


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
async def create_application(payload: ApplicationCreate, background_tasks: BackgroundTasks):
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

    # Trigger company research in background (non-blocking)
    if payload.company:
        background_tasks.add_task(
            _fetch_company_research_bg, payload.company, payload.job_title or ""
        )

    # Trigger ghost job analysis in background
    background_tasks.add_task(
        _run_ghost_analysis,
        row[0],
        payload.job_title,
        payload.company,
        payload.job_description or "",
        getattr(payload, 'posted_at', None),
        getattr(payload, 'board_signals', []) or [],
    )

    return {"id": row[0]}


async def _fetch_company_research_bg(company_name: str, job_title: str):
    """Background task: fetch company research after application is saved."""
    try:
        from services.company_research import fetch_company_brief, is_stale
        from services.ai_provider import AIProvider

        # Check if we already have fresh data
        async with get_db() as db:
            async with db.execute(
                "SELECT fetched_at FROM company_research WHERE company_name = ?",
                (company_name,)
            ) as cur:
                row = await cur.fetchone()

        if row and not is_stale(row["fetched_at"]):
            return  # Cache is fresh, skip

        async with get_db() as db:
            provider = await AIProvider.from_db(db)

        brief = await fetch_company_brief(provider, company_name, job_title)

        async with get_db() as db:
            await db.execute(
                """INSERT INTO company_research
                   (company_name, funding_stage, headcount_trend, recent_news,
                    glassdoor_sentiment, interview_patterns, raw_signals)
                   VALUES (?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(company_name) DO UPDATE SET
                     funding_stage=excluded.funding_stage,
                     headcount_trend=excluded.headcount_trend,
                     recent_news=excluded.recent_news,
                     glassdoor_sentiment=excluded.glassdoor_sentiment,
                     interview_patterns=excluded.interview_patterns,
                     raw_signals=excluded.raw_signals,
                     fetched_at=datetime('now')""",
                (
                    company_name,
                    brief.get("funding_stage"),
                    brief.get("headcount_trend"),
                    json.dumps(brief.get("recent_news", [])),
                    brief.get("glassdoor_sentiment"),
                    json.dumps(brief.get("interview_patterns", [])),
                    json.dumps(brief.get("tech_stack", [])),
                ),
            )
            await db.commit()
    except Exception:
        pass  # Background task — never crash the request


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


async def _run_ghost_analysis(app_id: int, job_title: str, company: str,
                               job_description: str, posted_at: str | None,
                               board_signals: list[str]):
    try:
        from services.ghost_detector import analyze_posting, estimate_age_days
        from services.ai_provider import AIProvider

        async with get_db() as db:
            provider = await AIProvider.from_db(db)

        result = await analyze_posting(
            provider, job_title, company, job_description or "",
            posted_at, board_signals
        )
        age_days = estimate_age_days(posted_at)

        async with get_db() as db:
            await db.execute(
                """UPDATE applications SET
                   is_ghost_flag = ?,
                   posting_age_days = ?
                   WHERE id = ?""",
                (1 if result.get("is_likely_ghost") else 0, age_days, app_id)
            )
            await db.commit()
    except Exception:
        pass


@router.post("/{app_id}/analyze-ghost")
async def analyze_ghost_posting(app_id: int, background_tasks: BackgroundTasks):
    """Manually trigger ghost job analysis for an application."""
    async with get_db() as db:
        async with db.execute(
            "SELECT job_title, company, job_description FROM applications WHERE id = ?",
            (app_id,)
        ) as cur:
            row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Application not found")

    background_tasks.add_task(
        _run_ghost_analysis,
        app_id,
        row["job_title"],
        row["company"],
        row["job_description"] or "",
        None,
        [],
    )
    return {"ok": True, "message": "Ghost analysis started in background"}
