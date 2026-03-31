from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import json
import httpx
from database import get_db, get_setting
from services.ai_provider import AIProvider
from services.resume_tailor import tailor_resume, tailor_resume_gap_fill
from services.cover_letter import generate_cover_letter
from services.ats_scorer import score_resume

router = APIRouter(prefix="/api/ai", tags=["ai"])


class TailorResumeRequest(BaseModel):
    job_description: str
    resume_id: Optional[int] = None
    resume_type: Optional[str] = None  # auto-select by type if resume_id not given


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


async def _resolve_resume_id(db, resume_id: int | None, resume_type: str | None) -> int:
    """Resolve which resume to use. Priority: explicit ID > type match > default > first."""
    if resume_id:
        return resume_id

    # Try to find by type
    if resume_type:
        async with db.execute(
            "SELECT id FROM resumes WHERE resume_type = ? ORDER BY is_default DESC, created_at DESC LIMIT 1",
            (resume_type,)
        ) as cur:
            row = await cur.fetchone()
        if row:
            return row["id"]

    # Fall back to default
    async with db.execute(
        "SELECT id FROM resumes WHERE is_default = 1 LIMIT 1"
    ) as cur:
        row = await cur.fetchone()
    if row:
        return row["id"]

    # Fall back to most recent
    async with db.execute(
        "SELECT id FROM resumes ORDER BY created_at DESC LIMIT 1"
    ) as cur:
        row = await cur.fetchone()
    if row:
        return row["id"]

    raise HTTPException(404, "No resumes found")


ATS_TARGET = 85      # minimum acceptable ATS score
MAX_PASSES  = 3      # initial pass + up to 2 gap-fill retries


@router.post("/tailor-resume")
async def tailor_resume_endpoint(req: TailorResumeRequest):
    if not req.job_description.strip():
        raise HTTPException(400, "job_description cannot be empty")
    async with get_db() as db:
        resolved_resume_id = await _resolve_resume_id(db, req.resume_id, req.resume_type)
        resume_content = await _get_resume_content(db, resolved_resume_id)
        if not resume_content.strip():
            raise HTTPException(422, "Resume has no content")
        provider = await AIProvider.from_db(db)

    # ── Pass 1: initial tailoring ────────────────────────────────────────────
    tailored = await tailor_resume(provider, req.job_description, resume_content)

    # ── Score then retry until ATS ≥ 85 or we hit MAX_PASSES ────────────────
    for pass_num in range(MAX_PASSES):
        async with get_db() as db:
            provider = await AIProvider.from_db(db)
        ats = await score_resume(provider, req.job_description, tailored)

        score = ats.get("score", 0)
        missing = ats.get("missing_keywords", [])

        if score >= ATS_TARGET or not missing or pass_num == MAX_PASSES - 1:
            break   # good enough, or no gap info to act on, or out of passes

        # ── Gap-fill pass: incorporate still-missing keywords ────────────────
        async with get_db() as db:
            provider = await AIProvider.from_db(db)
        tailored = await tailor_resume_gap_fill(
            provider,
            req.job_description,
            tailored,
            current_score=score,
            missing_keywords=missing,
        )

    return {
        "tailored_resume": tailored,
        "ats_score": ats.get("score", 0),
        "ats_details": ats,
        "passes": pass_num + 1,
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


class ModelsRequest(BaseModel):
    provider: Optional[str] = None   # "anthropic" | "ollama"; falls back to DB value
    api_key: Optional[str] = None    # Anthropic key from the UI (not yet saved)
    ollama_url: Optional[str] = None # Ollama URL from the UI (not yet saved)


@router.post("/models")
async def list_models(req: ModelsRequest):
    """Return the list of models available for the given provider."""
    async with get_db() as db:
        provider = req.provider or await get_setting(db, "provider") or "ollama"
        api_key = req.api_key or await get_setting(db, "anthropic_api_key") or ""
        ollama_url = (req.ollama_url or await get_setting(db, "ollama_url") or "http://localhost:11434").rstrip("/")

    if provider == "anthropic":
        if not api_key:
            return {"models": [], "error": "API key is required to fetch Anthropic models"}
        try:
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=api_key)
            page = await client.models.list(limit=100)
            models = [
                {"id": m.id, "display_name": getattr(m, "display_name", m.id)}
                for m in page.data
            ]
            # Sort: newest first (they come with created_at timestamps)
            models.sort(key=lambda m: m["id"], reverse=True)
            return {"models": models}
        except anthropic.AuthenticationError:
            return {"models": [], "error": "Invalid API key — check your key at console.anthropic.com"}
        except Exception as e:
            return {"models": [], "error": str(e)}
    else:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{ollama_url}/api/tags")
                resp.raise_for_status()
                tags = resp.json().get("models", [])
                models = [{"id": m["name"], "display_name": m["name"]} for m in tags]
            return {"models": models}
        except Exception as e:
            return {"models": [], "error": f"Cannot reach Ollama at {ollama_url} — {e}"}


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
        except anthropic.AuthenticationError:
            return {"ok": False, "provider": "anthropic", "error": "Invalid API key — check your key at console.anthropic.com"}
        except anthropic.NotFoundError:
            return {"ok": False, "provider": "anthropic", "error": f"Model '{provider.model}' not found — select a valid model in Settings"}
        except anthropic.APIConnectionError as e:
            return {"ok": False, "provider": "anthropic", "error": f"Cannot reach Anthropic API — check your internet connection ({e})"}
        except Exception as e:
            err = str(e)
            if "401" in err or "authentication" in err.lower() or "api_key" in err.lower():
                return {"ok": False, "provider": "anthropic", "error": "Invalid API key — check your key at console.anthropic.com"}
            return {"ok": False, "provider": "anthropic", "error": err}
