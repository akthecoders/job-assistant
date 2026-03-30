import json
import re
from services.ai_provider import AIProvider

SYSTEM_PROMPT = """You are an ATS optimization specialist. Your job is to make the MINIMAL targeted edits to a resume to improve its match for a specific job description.

Return a JSON array of exact text substitutions to make:
[
  {"from": "exact phrase from the resume", "to": "improved phrase"},
  ...
]

Rules:
- "from" must be an EXACT verbatim substring copied from the provided resume (case-sensitive)
- Keep "to" roughly the same character length — do NOT expand bullet points
- Make 8-15 changes maximum, focusing on highest-impact improvements
- Target: skill names, tool/technology names, action verbs, job title keywords
- Do NOT change: contact information, company names, dates, section headers, degree names
- Do NOT add new content — only substitute existing phrases
- Return ONLY a valid JSON array, no commentary, no markdown fences"""

USER_TEMPLATE = """JOB DESCRIPTION:
{job_description}

---

RESUME (copy phrases EXACTLY as they appear):
{resume_content}

---

Return the JSON array of minimal substitutions."""


def _apply_changes(original: str, changes: list[dict]) -> str:
    result = original
    applied = 0
    for change in changes:
        old = change.get("from", "").strip()
        new = change.get("to", "").strip()
        if not old or not new or old == new:
            continue
        if old in result:
            result = result.replace(old, new, 1)
            applied += 1
        # Case-insensitive fallback
        elif old.lower() in result.lower():
            idx = result.lower().find(old.lower())
            result = result[:idx] + new + result[idx + len(old):]
            applied += 1
    return result


async def tailor_resume(
    provider: AIProvider, job_description: str, resume_content: str
) -> str:
    user = USER_TEMPLATE.format(
        job_description=job_description,
        resume_content=resume_content,
    )
    raw = await provider.complete(SYSTEM_PROMPT, user)

    # Strip markdown fences if model wraps the JSON
    raw = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`").strip()

    try:
        changes = json.loads(raw)
        if not isinstance(changes, list):
            raise ValueError("expected list")
    except Exception:
        # Fallback: try extracting JSON array from response
        match = re.search(r"\[.*\]", raw, re.DOTALL)
        if match:
            try:
                changes = json.loads(match.group())
            except Exception:
                changes = []
        else:
            changes = []

    return _apply_changes(resume_content, changes)
