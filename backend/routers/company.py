import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import get_db
from services.ai_provider import AIProvider
from services.company_research import fetch_company_brief, is_stale

router = APIRouter(prefix="/api/company", tags=["company"])


class ResearchRequest(BaseModel):
    company_name: str
    job_title: Optional[str] = ""


@router.post("/research")
async def get_or_create_research(req: ResearchRequest):
    """Return cached brief or generate a new one."""
    if not req.company_name.strip():
        raise HTTPException(400, "company_name is required")

    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM company_research WHERE company_name = ?",
            (req.company_name,)
        ) as cur:
            row = await cur.fetchone()

    # Return cache if fresh
    if row and not is_stale(row["fetched_at"]):
        return _row_to_dict(row)

    # Generate new brief
    async with get_db() as db:
        provider = await AIProvider.from_db(db)

    brief = await fetch_company_brief(provider, req.company_name, req.job_title or "")

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
                req.company_name,
                brief.get("funding_stage"),
                brief.get("headcount_trend"),
                json.dumps(brief.get("recent_news", [])),
                brief.get("glassdoor_sentiment"),
                json.dumps(brief.get("interview_patterns", [])),
                json.dumps(brief.get("tech_stack", [])),
            ),
        )
        await db.commit()

        async with db.execute(
            "SELECT * FROM company_research WHERE company_name = ?",
            (req.company_name,)
        ) as cur:
            row = await cur.fetchone()

    return _row_to_dict(row)


@router.get("/research/{company_name:path}")
async def get_research(company_name: str):
    """Get cached research for a company."""
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM company_research WHERE company_name = ?", (company_name,)
        ) as cur:
            row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "No research found — POST to /api/company/research to generate")
    return _row_to_dict(row)


@router.delete("/research/{company_name:path}")
async def delete_research(company_name: str):
    """Bust cache to force re-fetch."""
    async with get_db() as db:
        await db.execute(
            "DELETE FROM company_research WHERE company_name = ?", (company_name,)
        )
        await db.commit()
    return {"ok": True}


def _row_to_dict(row) -> dict:
    d = dict(row)
    for field in ["recent_news", "interview_patterns", "raw_signals"]:
        if d.get(field):
            try:
                d[field] = json.loads(d[field])
            except Exception:
                d[field] = []
    return d
