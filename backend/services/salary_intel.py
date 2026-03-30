import json
import re
from services.ai_provider import AIProvider
from services.web_search import search

SYSTEM_PROMPT = """You are a compensation expert helping a job seeker understand salary expectations and negotiate effectively.

Given information about a role and company, provide salary intelligence and negotiation guidance.

Return ONLY a JSON object:
{
  "range_low": <integer, USD annual>,
  "range_mid": <integer, USD annual>,
  "range_high": <integer, USD annual>,
  "range_note": "<1 sentence: e.g. 'Based on US market data for senior roles at mid-size tech companies'>",
  "negotiation_script": "<3-4 paragraph negotiation email/script the candidate can use>",
  "counterargument_prep": [
    {"objection": "<likely employer objection>", "response": "<how to respond>"}
  ],
  "key_leverage_points": ["<point 1>", "<point 2>", ...],
  "data_sources": ["<source description 1>", ...]
}

Rules:
- range_low/mid/high: realistic market rates in USD, not aspirational
- negotiation_script: professional, specific to this role/company, not generic
- counterargument_prep: 3-4 realistic objections with strong responses
- key_leverage_points: what gives the candidate negotiating power
Output ONLY valid JSON, no markdown."""


async def generate_salary_intel(
    provider: AIProvider,
    role_title: str,
    company: str,
    location: str = "",
    offer_amount: int | None = None,
) -> dict:
    # Search for salary context
    queries = [
        f"{role_title} salary {location or 'US'} 2024 2025",
        f"{company} {role_title} compensation glassdoor levels.fyi",
    ]
    snippets = []
    for q in queries:
        results = await search(q, max_results=3)
        for r in results:
            snippets.append(f"[{r['title']}] {r['snippet']}")

    offer_context = f"Current offer: ${offer_amount:,}/year\n" if offer_amount else ""
    search_context = "\n".join(snippets[:6]) if snippets else "No search data available."

    user_msg = (
        f"Role: {role_title}\n"
        f"Company: {company}\n"
        f"Location: {location or 'United States'}\n"
        f"{offer_context}"
        f"\nMarket data from web:\n{search_context}"
    )

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

    return {
        "range_low": 0, "range_mid": 0, "range_high": 0,
        "range_note": "Could not fetch salary data",
        "negotiation_script": "Try again later.",
        "counterargument_prep": [],
        "key_leverage_points": [],
        "data_sources": [],
    }
