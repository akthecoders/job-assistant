"""
company_research.py — Fetch and synthesize a company brief from web search results.
Results are cached in the company_research table for CACHE_DAYS days.
"""
import json
import re
from datetime import datetime, timedelta
from services.ai_provider import AIProvider
from services.web_search import search

CACHE_DAYS = 7

SYSTEM_PROMPT = """You are a company research analyst.
Given search results about a company, synthesize a concise company brief for a job applicant.

Return ONLY a JSON object with this exact structure:
{
  "funding_stage": "<string: e.g. 'Series B', 'Public', 'Bootstrapped', 'Unknown'>",
  "headcount_trend": "<string: e.g. 'Growing (500→800 in 2 years)', 'Stable ~200 employees', 'Recent layoffs (2024)', 'Unknown'>",
  "recent_news": [
    {"title": "<headline>", "snippet": "<1-2 sentence summary>", "date": "<date or 'Recent'>"}
  ],
  "glassdoor_sentiment": "<string: 1-2 sentences summarizing employee sentiment if found, else 'No data found'>",
  "interview_patterns": ["<observed interview pattern 1>", "<pattern 2>", ...],
  "tech_stack": ["<technology 1>", "<technology 2>", ...]
}

Rules:
- recent_news: up to 3 most relevant items; include only if genuinely newsworthy
- interview_patterns: what candidates report about the hiring process (rounds, style, difficulty)
- tech_stack: technologies mentioned in job postings or company blog
- Be factual and concise. If information is unavailable, say so rather than guessing.
Output ONLY valid JSON, no markdown, no commentary."""


async def fetch_company_brief(
    provider: AIProvider,
    company_name: str,
    job_title: str = "",
) -> dict:
    """Fetch web signals and synthesize a company brief using AI."""
    queries = [
        f"{company_name} company funding news 2024 2025",
        f"{company_name} glassdoor reviews interview process",
        f"{company_name} {job_title} hiring tech stack".strip(),
    ]

    all_snippets = []
    for q in queries:
        results = await search(q, max_results=3)
        for r in results:
            all_snippets.append(f"[{r['title']}]\n{r['snippet']}\nURL: {r['url']}")

    if not all_snippets:
        return _empty_brief(company_name)

    search_context = "\n\n---\n\n".join(all_snippets[:9])
    user_msg = f"Company: {company_name}\n\nSearch results:\n{search_context}"

    raw = await provider.complete(SYSTEM_PROMPT, user_msg)
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

    return _empty_brief(company_name)


def _empty_brief(company_name: str) -> dict:
    return {
        "funding_stage": "Unknown",
        "headcount_trend": "Unknown",
        "recent_news": [],
        "glassdoor_sentiment": "No data found",
        "interview_patterns": [],
        "tech_stack": [],
    }


def is_stale(fetched_at: str) -> bool:
    """Return True if the cached brief is older than CACHE_DAYS."""
    try:
        fetched = datetime.fromisoformat(fetched_at)
        return datetime.utcnow() - fetched > timedelta(days=CACHE_DAYS)
    except Exception:
        return True
