from fastapi import APIRouter
from database import get_db
from services.ai_provider import AIProvider

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/funnel")
async def get_funnel():
    """Application counts and conversion rates by stage."""
    async with get_db() as db:
        async with db.execute(
            "SELECT status, COUNT(*) as count FROM applications GROUP BY status"
        ) as cur:
            rows = await cur.fetchall()

    counts = {r["status"]: r["count"] for r in rows}
    stages = ["saved", "applied", "interview", "offer", "rejected"]
    funnel = []
    for s in stages:
        funnel.append({"stage": s, "count": counts.get(s, 0)})

    total = counts.get("applied", 0) + counts.get("interview", 0) + counts.get("offer", 0)
    return {
        "funnel": funnel,
        "total_active": total,
        "response_rate": round(
            (counts.get("interview", 0) + counts.get("offer", 0)) / max(total, 1) * 100, 1
        ),
    }


@router.get("/patterns")
async def get_patterns():
    """Response rates and application patterns."""
    async with get_db() as db:
        # Applications by day of week
        async with db.execute(
            """SELECT strftime('%w', created_at) as dow, COUNT(*) as total,
                      SUM(CASE WHEN status IN ('interview','offer') THEN 1 ELSE 0 END) as responses
               FROM applications WHERE status != 'saved'
               GROUP BY dow ORDER BY dow"""
        ) as cur:
            dow_rows = await cur.fetchall()

        # ATS score distribution
        async with db.execute(
            """SELECT
                 AVG(ats_score) as avg_ats,
                 AVG(fit_score) as avg_fit,
                 COUNT(*) as total,
                 SUM(CASE WHEN status IN ('interview','offer') THEN 1 ELSE 0 END) as interviews
               FROM applications WHERE ats_score IS NOT NULL"""
        ) as cur:
            score_row = await cur.fetchone()

        # Ghost flag stats
        async with db.execute(
            "SELECT COUNT(*) as total, SUM(is_ghost_flag) as ghosts FROM applications"
        ) as cur:
            ghost_row = await cur.fetchone()

    days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    dow_data = []
    for r in dow_rows:
        total = r["total"] or 0
        responses = r["responses"] or 0
        dow_data.append({
            "day": days[int(r["dow"])],
            "applications": total,
            "responses": responses,
            "response_rate": round(responses / max(total, 1) * 100, 1),
        })

    return {
        "by_day_of_week": dow_data,
        "score_stats": dict(score_row) if score_row else {},
        "ghost_stats": {
            "total": ghost_row["total"] if ghost_row else 0,
            "likely_ghost": ghost_row["ghosts"] if ghost_row else 0,
        },
    }


@router.get("/diagnostics")
async def get_diagnostics():
    """AI-generated suggestions based on application patterns."""
    async with get_db() as db:
        async with db.execute(
            """SELECT status, COUNT(*) as count FROM applications GROUP BY status"""
        ) as cur:
            rows = await cur.fetchall()
        async with db.execute(
            "SELECT AVG(ats_score) as avg_ats FROM applications WHERE ats_score IS NOT NULL"
        ) as cur:
            score_row = await cur.fetchone()

    counts = {r["status"]: r["count"] for r in rows}
    tips = []

    applied = counts.get("applied", 0)
    interview = counts.get("interview", 0)
    total = applied + interview + counts.get("offer", 0)

    if total < 5:
        tips.append("Apply to more positions to generate meaningful pattern data.")
    if total > 10 and interview == 0:
        tips.append("Low interview rate — consider getting your resume reviewed and adding more keywords.")
    if score_row and score_row["avg_ats"] and score_row["avg_ats"] < 65:
        tips.append(f"Average ATS score is {round(score_row['avg_ats'])}% — use 'Tailor Resume' more often before applying.")
    if counts.get("saved", 0) > 10:
        tips.append(f"You have {counts.get('saved', 0)} saved jobs — try applying to some!")
    if not tips:
        tips.append("Keep applying consistently. Most offers come after 20-40 applications.")

    return {"tips": tips, "counts": counts}
