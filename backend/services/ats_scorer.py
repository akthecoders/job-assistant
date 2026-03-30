import json
import re
from services.ai_provider import AIProvider

SYSTEM_PROMPT = """You are an ATS (Applicant Tracking System) expert.
Analyze the resume against the job description and return a JSON object with exactly these fields:
{
  "score": <integer 0-100>,
  "matched_keywords": [<list of keywords/phrases present in both resume and job description>],
  "missing_keywords": [<list of important keywords from job description NOT in resume>],
  "recommendations": [<list of 3-5 specific, actionable improvement suggestions>]
}

Scoring guide:
- 85-100: Excellent match, most keywords present
- 70-84: Good match, minor gaps
- 50-69: Moderate match, several gaps
- Below 50: Poor match, significant gaps

Return ONLY valid JSON, no commentary, no markdown fences."""

USER_TEMPLATE = """JOB DESCRIPTION:
{job_description}

---

RESUME:
{resume_content}

Analyze and return the JSON object."""


async def score_resume(
    provider: AIProvider, job_description: str, resume_content: str
) -> dict:
    user = USER_TEMPLATE.format(
        job_description=job_description,
        resume_content=resume_content,
    )
    raw = await provider.complete(SYSTEM_PROMPT, user)

    # Strip markdown fences if model adds them anyway
    raw = re.sub(r"```(?:json)?", "", raw).strip().rstrip("```").strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Fallback: extract JSON object from response
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            return json.loads(match.group())
        return {
            "score": 0,
            "matched_keywords": [],
            "missing_keywords": [],
            "recommendations": ["Could not parse ATS score. Please try again."],
        }
