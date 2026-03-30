import json
import re
from services.ai_provider import AIProvider

LINKEDIN_PROMPT = """You are an expert at writing personalized LinkedIn connection requests.
Write a LinkedIn connection message for a job seeker reaching out to someone at a company they want to join.

Rules:
- Maximum 300 characters (LinkedIn limit)
- Be specific and genuine — mention the role or team, not just "I'm interested in your company"
- Do NOT use "I came across your profile" — it's overused
- Professional but warm tone
- No emojis
- End with a clear but soft ask (learn more, connect, brief chat)

Output ONLY the message text, nothing else."""

COLD_EMAIL_PROMPT = """You are an expert at writing cold outreach emails for job seekers.
Write a concise cold email from a job seeker to a relevant contact at their target company.

Rules:
- Subject line on first line, then blank line, then body
- Body: 3 short paragraphs max (under 150 words total)
- Paragraph 1: Hook — why you're reaching out specifically to them
- Paragraph 2: Brief credibility — 1-2 specific things from your background
- Paragraph 3: Clear, low-friction ask (15-min call, referral, advice)
- No generic phrases like "I hope this finds you well"
- No attachments mentioned — keep it light

Format your output as:
SUBJECT: <subject line>

<email body>"""

EMAIL_TYPE_PROMPTS = {
    "cold_outreach": """Write a cold outreach email to a recruiter or employee at this company.
Keep it under 100 words. Professional, specific, with a clear ask.""",

    "followup_1w": """Write a 1-week follow-up email after submitting a job application.
Keep it under 60 words. Reference the specific role. Polite, not pushy. Reaffirm interest.""",

    "followup_2w": """Write a 2-week follow-up email for a job application with no response.
Under 50 words. More concise than the first follow-up. Offer to provide additional info.""",

    "thank_you": """Write a post-interview thank you email.
Under 80 words. Reference something specific from the interview. Reaffirm fit. Professional.""",

    "negotiation": """Write an offer negotiation email opener.
Under 100 words. Express enthusiasm for the offer. Professionally request a higher salary.
Mention market data context. Leave room for dialogue.""",
}


async def generate_linkedin_message(
    provider: AIProvider,
    company: str,
    job_title: str,
    contact_name: str = "",
    contact_title: str = "",
    resume_snippet: str = "",
) -> str:
    context = (
        f"Job seeker applying for: {job_title} at {company}\n"
        f"Contact: {contact_name or 'a team member'} ({contact_title or 'employee'})\n"
        f"Resume highlights: {resume_snippet[:300] if resume_snippet else 'Not provided'}"
    )
    return await provider.complete(LINKEDIN_PROMPT, context)


async def generate_cold_email(
    provider: AIProvider,
    company: str,
    job_title: str,
    contact_name: str = "",
    contact_title: str = "",
    resume_snippet: str = "",
) -> dict:
    context = (
        f"Job seeker applying for: {job_title} at {company}\n"
        f"Contact: {contact_name or 'a hiring manager'} ({contact_title or 'employee'})\n"
        f"Resume highlights: {resume_snippet[:300] if resume_snippet else 'Not provided'}"
    )
    raw = await provider.complete(COLD_EMAIL_PROMPT, context)
    lines = raw.strip().split("\n")
    subject = ""
    body_lines = []
    for i, line in enumerate(lines):
        if line.startswith("SUBJECT:"):
            subject = line.replace("SUBJECT:", "").strip()
        elif subject and line.strip():
            body_lines = lines[i:]
            break
    return {"subject": subject, "body": "\n".join(body_lines).strip()}


async def generate_email_draft(
    provider: AIProvider,
    email_type: str,
    job_title: str,
    company: str,
    extra_context: str = "",
) -> dict:
    base_prompt = EMAIL_TYPE_PROMPTS.get(email_type, EMAIL_TYPE_PROMPTS["cold_outreach"])
    context = f"Role: {job_title}\nCompany: {company}\n{extra_context}"
    raw = await provider.complete(base_prompt, context)
    lines = raw.strip().split("\n")
    subject = f"Re: {job_title} at {company}"
    body = raw.strip()
    for i, line in enumerate(lines):
        if line.startswith("SUBJECT:"):
            subject = line.replace("SUBJECT:", "").strip()
            body = "\n".join(lines[i+1:]).strip()
            break
    return {"subject": subject, "body": body}
