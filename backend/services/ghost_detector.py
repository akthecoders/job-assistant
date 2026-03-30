import json
import re
from datetime import datetime, date
from services.ai_provider import AIProvider

SYSTEM_PROMPT = """You are an expert at identifying ghost job postings.
Given information about a job posting, analyze signals that suggest whether it's a real active opening.

Return ONLY a JSON object:
{
  "is_likely_ghost": <true|false>,
  "confidence": <"high"|"medium"|"low">,
  "freshness_signals": ["<signal 1>", "<signal 2>", ...],
  "warning_flags": ["<red flag if ghost>", ...],
  "recommendation": "<1-2 sentence advice for the applicant>"
}

Ghost job indicators: posted >60 days ago, same posting reappears repeatedly,
no company hiring activity, vague or templated description, no specific team mentioned.
Output ONLY valid JSON."""


async def analyze_posting(
    provider: AIProvider,
    job_title: str,
    company: str,
    job_description: str,
    posted_at: str | None = None,
    board_signals: list[str] | None = None,
) -> dict:
    age_info = ""
    if posted_at:
        try:
            posted_date = datetime.fromisoformat(posted_at.replace("Z", "+00:00")).date()
            days_old = (date.today() - posted_date).days
            age_info = f"Posted: {posted_at} ({days_old} days ago)"
        except Exception:
            age_info = f"Posted date: {posted_at}"

    context = (
        f"Job: {job_title} at {company}\n"
        f"{age_info}\n"
        f"Board signals: {', '.join(board_signals) if board_signals else 'None detected'}\n\n"
        f"Job description (first 800 chars):\n{job_description[:800]}"
    )

    raw = await provider.complete(SYSTEM_PROMPT, context)
    cleaned = re.sub(r"```(?:json)?", "", raw).strip().rstrip("```").strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except Exception:
                pass

    return {
        "is_likely_ghost": False,
        "confidence": "low",
        "freshness_signals": [],
        "warning_flags": [],
        "recommendation": "Could not analyze this posting.",
    }


def estimate_age_days(posted_at: str | None) -> int | None:
    if not posted_at:
        return None
    try:
        posted_date = datetime.fromisoformat(posted_at.replace("Z", "+00:00")).date()
        return (date.today() - posted_date).days
    except Exception:
        return None
