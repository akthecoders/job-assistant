import json
import re
from services.ai_provider import AIProvider

SYSTEM_PROMPT = """You are an expert job application analyst.
Given a job description and a candidate's resume, analyze how well the resume matches the job requirements.

Return ONLY a JSON object with this exact structure:
{
  "fit_score": <integer 0-100>,
  "met_requirements": ["requirement that is clearly met", ...],
  "unmet_requirements": ["requirement that is missing or unclear", ...],
  "skills_gap": ["specific skill mentioned in JD not found in resume", ...],
  "bridging_suggestions": ["If you have X experience, describe it as Y to match this JD", ...]
}

Rules:
- fit_score: 0-100 based on overall match. 80+ = strong match, 60-79 = moderate, below 60 = weak
- met_requirements: list actual requirements from the JD the resume clearly satisfies
- unmet_requirements: list actual requirements from the JD that are missing or unclear
- skills_gap: specific technical skills, tools, or certifications in the JD not in the resume
- bridging_suggestions: 3-5 practical tips to better position existing experience
- Be honest and specific — do not invent experience the candidate doesn't have
Output ONLY valid JSON, no markdown, no commentary."""


async def score_fit(provider: AIProvider, job_description: str, resume_content: str) -> dict:
    user_msg = f"JOB DESCRIPTION:\n{job_description}\n\nRESUME:\n{resume_content}"
    raw = await provider.complete(SYSTEM_PROMPT, user_msg)

    # Strip markdown fences
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
        "fit_score": 0,
        "met_requirements": [],
        "unmet_requirements": [],
        "skills_gap": [],
        "bridging_suggestions": ["Could not analyze — try again."],
    }
