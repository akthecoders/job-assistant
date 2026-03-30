import json
from fastapi import APIRouter, HTTPException
from database import get_db
from services.ai_provider import AIProvider
from services.fit_scorer import score_fit

router = APIRouter(prefix="/api/fit", tags=["fit"])


async def _get_application(db, app_id: int) -> dict:
    async with db.execute(
        "SELECT id, job_description, resume_id FROM applications WHERE id = ?", (app_id,)
    ) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(404, f"Application {app_id} not found")
    return dict(row)


async def _get_resume_content(db, resume_id: int) -> str:
    async with db.execute(
        "SELECT content FROM resumes WHERE id = ?", (resume_id,)
    ) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(404, f"Resume {resume_id} not found")
    return row["content"]


@router.post("/{app_id}/score")
async def score_application_fit(app_id: int):
    """Score the linked resume against the job description. Saves result to DB."""
    async with get_db() as db:
        app = await _get_application(db, app_id)
        if not app["job_description"]:
            raise HTTPException(422, "Application has no job description")
        if not app["resume_id"]:
            raise HTTPException(422, "Application has no linked resume")
        resume_content = await _get_resume_content(db, app["resume_id"])
        provider = await AIProvider.from_db(db)

    result = await score_fit(provider, app["job_description"], resume_content)

    async with get_db() as db:
        await db.execute(
            "UPDATE applications SET fit_score = ?, fit_details = ? WHERE id = ?",
            (result.get("fit_score", 0), json.dumps(result), app_id),
        )
        await db.commit()

    return result


@router.get("/{app_id}")
async def get_fit_score(app_id: int):
    """Get cached fit score for an application."""
    async with get_db() as db:
        async with db.execute(
            "SELECT fit_score, fit_details FROM applications WHERE id = ?", (app_id,)
        ) as cur:
            row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Application not found")
    if row["fit_details"] is None:
        return {"fit_score": None, "message": "Not yet scored — POST to /{app_id}/score"}
    details = json.loads(row["fit_details"])
    return details
