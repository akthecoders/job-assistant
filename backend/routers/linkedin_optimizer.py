from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import get_db
from services.ai_provider import AIProvider

router = APIRouter(prefix="/api/linkedin", tags=["linkedin"])

HEADLINE_PROMPT = """You are an expert LinkedIn profile optimizer.
Rewrite this LinkedIn headline to be more recruiter-magnetic.

Rules:
- Max 220 characters
- Lead with value, not job title (e.g. "Building X | Helping companies do Y" not just "Senior Engineer at Z")
- Include 2-3 relevant keywords naturally
- Show impact or specialization
- No buzzwords like "passionate", "guru", "ninja", "rockstar"

Output ONLY the rewritten headline, nothing else."""

SUMMARY_PROMPT = """You are an expert LinkedIn profile optimizer.
Rewrite this LinkedIn About/Summary section to be compelling and recruiter-magnetic.

Rules:
- 3-4 short paragraphs, max 2000 characters total
- Paragraph 1: Hook — what you do and the impact you create
- Paragraph 2: Core expertise and what makes you different
- Paragraph 3: Notable achievements (use numbers where possible)
- Paragraph 4: What you're looking for / open to (optional but recommended)
- Write in first person, conversational but professional
- No "I am passionate about..." or other clichés
- End with a clear call to action

Output ONLY the rewritten summary, nothing else."""


class OptimizeRequest(BaseModel):
    headline: str
    summary: str
    resume_id: Optional[int] = None


@router.post("/optimize")
async def optimize_linkedin(req: OptimizeRequest):
    if not req.headline.strip() and not req.summary.strip():
        raise HTTPException(400, "At least headline or summary is required")

    async with get_db() as db:
        provider = await AIProvider.from_db(db)

        # Optionally pull resume context
        resume_context = ""
        if req.resume_id:
            async with db.execute(
                "SELECT substr(content, 1, 500) as snippet FROM resumes WHERE id = ?",
                (req.resume_id,)
            ) as cur:
                row = await cur.fetchone()
            if row:
                resume_context = f"\n\nResume context:\n{row['snippet']}"

    results = {}

    if req.headline.strip():
        user_msg = f"Current headline: {req.headline}{resume_context}"
        results["headline"] = await provider.complete(HEADLINE_PROMPT, user_msg)

    if req.summary.strip():
        user_msg = f"Current summary:\n{req.summary}{resume_context}"
        results["summary"] = await provider.complete(SUMMARY_PROMPT, user_msg)

    return results
