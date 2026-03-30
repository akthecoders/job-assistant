"""
web_search.py — Free web search via DuckDuckGo HTML endpoint.
No API key required. Returns list of {title, url, snippet} dicts.
"""
import re
from urllib.parse import unquote
import httpx
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}

DDG_URL = "https://html.duckduckgo.com/html/"


async def search(query: str, max_results: int = 5) -> list[dict]:
    """Search DuckDuckGo and return up to max_results results as {title, url, snippet}."""
    try:
        async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True, timeout=10.0) as client:
            resp = await client.post(DDG_URL, data={"q": query, "b": ""})
            resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "lxml")
        results = []

        for result in soup.select(".result__body"):
            title_el = result.select_one(".result__title a")
            snippet_el = result.select_one(".result__snippet")
            if not title_el:
                continue

            url = _extract_url(title_el.get("href", ""))
            if not url:
                continue

            results.append({
                "title": title_el.get_text(strip=True),
                "url": url,
                "snippet": snippet_el.get_text(strip=True) if snippet_el else "",
            })

            if len(results) >= max_results:
                break

        return results

    except Exception:
        return []


def _extract_url(href: str) -> str:
    """Extract real URL from DuckDuckGo redirect wrapper."""
    if href.startswith("http"):
        return href
    match = re.search(r"uddg=([^&]+)", href)
    if match:
        return unquote(match.group(1))
    return ""


async def fetch_page_text(url: str, max_chars: int = 3000) -> str:
    """Fetch a URL and return its visible text content (truncated)."""
    try:
        async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True, timeout=10.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        text = " ".join(soup.get_text(" ", strip=True).split())
        return text[:max_chars]
    except Exception:
        return ""
