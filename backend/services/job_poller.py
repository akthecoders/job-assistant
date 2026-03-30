"""
Job alert polling service.
Uses DuckDuckGo search to find new job postings matching alert keywords.
No API keys required.
"""
import asyncio
import logging
from datetime import datetime, timedelta
from database import get_db
from services.web_search import search

logger = logging.getLogger(__name__)


async def poll_alert(alert_id: int, keywords: str, location: str, frequency: str) -> int:
    """Poll for new job matches for a single alert. Returns number of new results found."""
    if location and location.lower() not in ('remote', 'any', ''):
        query = f'"{keywords}" jobs in {location}'
    else:
        query = f'"{keywords}" remote jobs'

    results = await search(query, max_results=10)
    new_count = 0

    async with get_db() as db:
        for r in results:
            url = r.get('url', '')
            if not url:
                continue

            # Check for duplicate URL
            async with db.execute(
                "SELECT id FROM job_alert_results WHERE alert_id=? AND job_url=?",
                (alert_id, url)
            ) as cur:
                if await cur.fetchone():
                    continue  # already seen

            await db.execute(
                """INSERT INTO job_alert_results (alert_id, job_title, company, job_url, snippet, found_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    alert_id,
                    r.get('title', ''),
                    '',  # company not extracted from search snippet
                    url,
                    r.get('snippet', ''),
                    datetime.utcnow().isoformat(),
                )
            )
            new_count += 1

        # Update last_run_at
        await db.execute(
            "UPDATE job_alerts SET last_run_at=? WHERE id=?",
            (datetime.utcnow().isoformat(), alert_id)
        )
        await db.commit()

    return new_count


async def run_due_alerts():
    """Check all active alerts and poll those that are due."""
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM job_alerts WHERE is_active=1"
        ) as cur:
            alerts = await cur.fetchall()

    for alert in alerts:
        try:
            last = alert['last_run_at']
            freq = alert['frequency'] if 'frequency' in alert.keys() else 'daily'
            due = False

            if not last:
                due = True
            else:
                last_dt = datetime.fromisoformat(last)
                now = datetime.utcnow()
                if freq == 'daily':
                    due = (now - last_dt) > timedelta(hours=23)
                elif freq == 'twice_daily':
                    due = (now - last_dt) > timedelta(hours=11)
                elif freq == 'weekly':
                    due = (now - last_dt) > timedelta(days=6)
                else:
                    due = (now - last_dt) > timedelta(hours=23)

            if due:
                keywords = alert['query_keywords']
                location = alert['location'] or ''
                count = await poll_alert(
                    alert['id'],
                    keywords,
                    location,
                    freq,
                )
                if count > 0:
                    logger.info(f"Alert '{keywords}': {count} new results")
        except Exception as e:
            logger.error(f"Error polling alert {alert['id']}: {e}")
