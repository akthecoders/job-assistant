from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import json
from database import get_db
from services.ai_provider import AIProvider
from services.resume_tailor import tailor_resume
from services.cover_letter import generate_cover_letter
from services.ats_scorer import score_resume

router = APIRouter(prefix="/api/ai", tags=["ai"])


class TailorResumeRequest(BaseModel):
    job_description: str
    resume_id: int


class CoverLetterRequest(BaseModel):
    job_description: str
    resume_id: int
    company: str
    role: str


class ATSScoreRequest(BaseModel):
    job_description: str
    resume_text: str


async def _get_resume_content(db, resume_id: int) -> str:
    async with db.execute(
        "SELECT content FROM resumes WHERE id = ?", (resume_id,)
    ) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(404, f"Resume {resume_id} not found")
    return row["content"]


@router.post("/tailor-resume")
async def tailor_resume_endpoint(req: TailorResumeRequest):
    if not req.job_description.strip():
        raise HTTPException(400, "job_description cannot be empty")
    async with get_db() as db:
        resume_content = await _get_resume_content(db, req.resume_id)
        if not resume_content.strip():
            raise HTTPException(422, "Resume has no content")
        provider = await AIProvider.from_db(db)

    tailored = await tailor_resume(provider, req.job_description, resume_content)

    # Score the tailored resume
    async with get_db() as db:
        provider = await AIProvider.from_db(db)
    ats = await score_resume(provider, req.job_description, tailored)

    return {
        "tailored_resume": tailored,
        "ats_score": ats.get("score", 0),
        "ats_details": ats,
    }


@router.post("/cover-letter")
async def cover_letter_endpoint(req: CoverLetterRequest):
    if not req.job_description.strip():
        raise HTTPException(400, "job_description cannot be empty")
    async with get_db() as db:
        resume_content = await _get_resume_content(db, req.resume_id)
        if not resume_content.strip():
            raise HTTPException(422, "Resume has no content")
        provider = await AIProvider.from_db(db)

    letter = await generate_cover_letter(
        provider, req.job_description, resume_content, req.company, req.role
    )
    return {"cover_letter": letter}


@router.post("/ats-score")
async def ats_score_endpoint(req: ATSScoreRequest):
    async with get_db() as db:
        provider = await AIProvider.from_db(db)
    result = await score_resume(provider, req.job_description, req.resume_text)
    return result


@router.get("/health")
async def ai_health():
    """Check if the configured AI provider is reachable."""
    async with get_db() as db:
        provider = await AIProvider.from_db(db)

    if provider.provider == "ollama":
        import httpx
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{provider.ollama_url}/api/tags")
                resp.raise_for_status()
                models = [m["name"] for m in resp.json().get("models", [])]
            return {"ok": True, "provider": "ollama", "models": models}
        except Exception as e:
            return {"ok": False, "provider": "ollama", "error": str(e)}
    else:
        if not provider.api_key:
            return {"ok": False, "provider": "anthropic", "error": "API key not set"}
        try:
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=provider.api_key)
            # Cheapest real call: 1-token response to validate the key
            await client.messages.create(
                model=provider.model,
                max_tokens=1,
                messages=[{"role": "user", "content": "hi"}],
            )
            return {"ok": True, "provider": "anthropic", "model": provider.model}
        except Exception as e:
            err = str(e)
            if "401" in err or "authentication" in err.lower() or "api_key" in err.lower():
                return {"ok": False, "provider": "anthropic", "error": "Invalid API key"}
            return {"ok": False, "provider": "anthropic", "error": err}
