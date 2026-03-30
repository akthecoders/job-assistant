from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from database import get_db
from services.job_poller import poll_alert, run_due_alerts

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


class AlertCreate(BaseModel):
    keywords: str
    location: Optional[str] = None
    frequency: str = "daily"  # daily, twice_daily, weekly


@router.get("")
async def list_alerts():
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM job_alerts ORDER BY created_at DESC"
        ) as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]


@router.post("", status_code=201)
async def create_alert(alert: AlertCreate, background_tasks: BackgroundTasks):
    if alert.frequency not in ("daily", "twice_daily", "weekly"):
        raise HTTPException(400, "frequency must be daily, twice_daily, or weekly")
    async with get_db() as db:
        async with db.execute(
            """INSERT INTO job_alerts (query_keywords, location, frequency, is_active)
               VALUES (?, ?, ?, 1)""",
            (alert.keywords, alert.location, alert.frequency)
        ) as cur:
            alert_id = cur.lastrowid
        await db.commit()
    # Kick off first poll immediately in background
    background_tasks.add_task(
        poll_alert, alert_id, alert.keywords, alert.location or '', alert.frequency
    )
    return {"id": alert_id, "keywords": alert.keywords}


@router.delete("/{alert_id}")
async def delete_alert(alert_id: int):
    async with get_db() as db:
        async with db.execute("SELECT id FROM job_alerts WHERE id=?", (alert_id,)) as cur:
            if not await cur.fetchone():
                raise HTTPException(404, "Alert not found")
        await db.execute("DELETE FROM job_alert_results WHERE alert_id=?", (alert_id,))
        await db.execute("DELETE FROM job_alerts WHERE id=?", (alert_id,))
        await db.commit()
    return {"ok": True}


@router.patch("/{alert_id}/toggle")
async def toggle_alert(alert_id: int):
    async with get_db() as db:
        async with db.execute("SELECT is_active FROM job_alerts WHERE id=?", (alert_id,)) as cur:
            row = await cur.fetchone()
        if not row:
            raise HTTPException(404, "Alert not found")
        new_state = 0 if row["is_active"] else 1
        await db.execute(
            "UPDATE job_alerts SET is_active=? WHERE id=?", (new_state, alert_id)
        )
        await db.commit()
    return {"is_active": new_state}


@router.get("/{alert_id}/results")
async def get_results(alert_id: int, limit: int = 50):
    async with get_db() as db:
        async with db.execute(
            """SELECT * FROM job_alert_results
               WHERE alert_id=? ORDER BY found_at DESC LIMIT ?""",
            (alert_id, limit)
        ) as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]


@router.post("/{alert_id}/poll")
async def manual_poll(alert_id: int, background_tasks: BackgroundTasks):
    """Manually trigger a poll for this alert."""
    async with get_db() as db:
        async with db.execute("SELECT * FROM job_alerts WHERE id=?", (alert_id,)) as cur:
            row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Alert not found")
    freq = row["frequency"] if "frequency" in row.keys() else "daily"
    background_tasks.add_task(
        poll_alert, alert_id, row["query_keywords"], row["location"] or '', freq
    )
    return {"ok": True, "message": "Poll triggered"}


@router.post("/run-all")
async def run_all_alerts(background_tasks: BackgroundTasks):
    """Trigger all due alerts (called by scheduler or manually)."""
    background_tasks.add_task(run_due_alerts)
    return {"ok": True}
