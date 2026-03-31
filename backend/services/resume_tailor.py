import json
import re
from services.ai_provider import AIProvider

SYSTEM_PROMPT = """You are a senior ATS optimization specialist. Your goal is to tailor a resume so it scores 85 or above when evaluated against a job description.

Return a JSON array of exact text substitutions:
[
  {"from": "exact phrase from the resume", "to": "improved phrase"},
  ...
]

Rules:
- "from" must be an EXACT verbatim substring from the provided resume (case-sensitive match)
- "to" should incorporate keywords, tools, and phrases from the job description
- Make as many changes as needed (up to 25) to reach an ATS score of 85+
- Priority targets: skill names, technologies, tools, certifications, action verbs, job title keywords
- You MAY expand short phrases to include additional keywords, but keep changes natural
- Do NOT change: contact information, company names, dates, section headers, degree names
- Do NOT fabricate experience or credentials — only rephrase/reframe existing content
- Return ONLY a valid JSON array, no commentary, no markdown fences"""

USER_TEMPLATE = """JOB DESCRIPTION:
{job_description}

---

RESUME (copy phrases EXACTLY as they appear):
{resume_content}

---

Target ATS score: 85+. Return the JSON array of substitutions."""

GAP_SYSTEM_PROMPT = """You are a senior ATS optimization specialist doing a targeted second pass on a resume.
The first tailoring pass scored {current_score}/100. The target is 85+.

The following keywords from the job description are STILL MISSING from the resume:
{missing_keywords}

Your task: produce additional substitutions that naturally weave these missing keywords into the resume.

Return a JSON array of exact text substitutions:
[
  {"from": "exact phrase from the resume", "to": "improved phrase that includes missing keywords"},
  ...
]

Rules:
- "from" must be an EXACT verbatim substring from the current resume (case-sensitive)
- Focus ONLY on missing keywords listed above — do not redo already-matched content
- Keep language natural and truthful — do not fabricate experience
- Return ONLY a valid JSON array, no commentary"""

GAP_USER_TEMPLATE = """JOB DESCRIPTION:
{job_description}

---

CURRENT RESUME (after first pass):
{resume_content}

---

Produce substitutions that add the missing keywords listed in the system prompt. Return the JSON array."""


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


def _parse_changes(raw: str) -> list[dict]:
    """Parse a JSON array of substitutions from a raw LLM response."""
    raw = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`").strip()
    try:
        result = json.loads(raw)
        if isinstance(result, list):
            return result
    except Exception:
        pass
    # Fallback: extract first JSON array found in the text
    match = re.search(r"\[.*\]", raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except Exception:
            pass
    return []


async def tailor_resume(
    provider: AIProvider, job_description: str, resume_content: str
) -> str:
    """First-pass tailoring. Targets an ATS score of 85+."""
    user = USER_TEMPLATE.format(
        job_description=job_description,
        resume_content=resume_content,
    )
    raw = await provider.complete(SYSTEM_PROMPT, user)
    changes = _parse_changes(raw)
    return _apply_changes(resume_content, changes)


async def tailor_resume_gap_fill(
    provider: AIProvider,
    job_description: str,
    resume_content: str,
    current_score: int,
    missing_keywords: list[str],
) -> str:
    """Second-pass tailoring that targets specific missing keywords."""
    if not missing_keywords:
        return resume_content

    system = GAP_SYSTEM_PROMPT.format(
        current_score=current_score,
        missing_keywords=", ".join(missing_keywords),
    )
    user = GAP_USER_TEMPLATE.format(
        job_description=job_description,
        resume_content=resume_content,
    )
    raw = await provider.complete(system, user)
    changes = _parse_changes(raw)
    return _apply_changes(resume_content, changes)
