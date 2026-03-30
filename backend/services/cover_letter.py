from services.ai_provider import AIProvider

SYSTEM_PROMPT = """You are an expert career coach and cover letter writer.
Write a concise, personalized cover letter for a job application.
Guidelines:
- Professional but not generic — show genuine interest in the specific role
- 3 short paragraphs maximum (opening, why you're a fit, closing)
- Reference specific requirements or responsibilities from the job description
- Highlight 2-3 most relevant achievements from the resume
- Do NOT use filler phrases like "I am writing to express my interest" or "I would be a great fit"
- Do NOT include placeholders like [Your Name] or [Date] — write the body only
- Keep it under 250 words

Output ONLY the cover letter body text, no subject line, no salutation header, no signature."""

USER_TEMPLATE = """JOB TITLE: {role}
COMPANY: {company}

JOB DESCRIPTION:
{job_description}

---

CANDIDATE'S RESUME:
{resume_content}

---

Write a personalized cover letter for this application."""


async def generate_cover_letter(
    provider: AIProvider,
    job_description: str,
    resume_content: str,
    company: str,
    role: str,
) -> str:
    user = USER_TEMPLATE.format(
        role=role,
        company=company,
        job_description=job_description,
        resume_content=resume_content,
    )
    return await provider.complete(SYSTEM_PROMPT, user)
