import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from database import get_db
from services.ai_provider import AIProvider
from services.interview_coach import generate_questions, score_star_answer

router = APIRouter(prefix="/api/interview", tags=["interview"])


class GenerateRequest(BaseModel):
    types: List[str] = ["behavioral", "technical", "situational"]
    count: int = 8


class AnswerSubmit(BaseModel):
    answer: str


@router.post("/{app_id}/generate")
async def generate_interview_questions(app_id: int, req: GenerateRequest):
    """Generate role-specific interview questions from the application's JD."""
    async with get_db() as db:
        async with db.execute(
            "SELECT job_description, job_title FROM applications WHERE id = ?", (app_id,)
        ) as cur:
            row = await cur.fetchone()

    if not row:
        raise HTTPException(404, "Application not found")
    if not row["job_description"]:
        raise HTTPException(422, "Application has no job description")

    async with get_db() as db:
        provider = await AIProvider.from_db(db)

    questions = await generate_questions(
        provider,
        row["job_description"],
        job_title=row["job_title"] or "",
        types=req.types,
        count=req.count,
    )

    if not questions:
        raise HTTPException(502, "AI failed to generate questions — try again")

    # Save to DB
    saved = []
    async with get_db() as db:
        for q in questions:
            async with db.execute(
                """INSERT INTO interview_questions (application_id, question, question_type)
                   VALUES (?, ?, ?) RETURNING id""",
                (app_id, q.get("question", ""), q.get("question_type", "behavioral")),
            ) as cur:
                new_row = await cur.fetchone()
            saved.append({
                "id": new_row[0],
                "application_id": app_id,
                "question": q.get("question", ""),
                "question_type": q.get("question_type", "behavioral"),
                "why_asked": q.get("why_asked", ""),
                "user_answer": None,
                "ai_score": None,
                "ai_feedback": None,
            })
        await db.commit()

    return saved


@router.get("/{app_id}/questions")
async def list_questions(app_id: int):
    """List all interview questions for an application."""
    async with get_db() as db:
        async with db.execute(
            """SELECT id, application_id, question, question_type,
                      user_answer, ai_score, ai_feedback, created_at
               FROM interview_questions WHERE application_id = ?
               ORDER BY created_at DESC""",
            (app_id,),
        ) as cur:
            rows = await cur.fetchall()

    result = []
    for r in rows:
        d = dict(r)
        if d.get("ai_feedback"):
            try:
                d["ai_feedback"] = json.loads(d["ai_feedback"])
            except Exception:
                pass
        result.append(d)
    return result


@router.put("/questions/{q_id}/answer")
async def submit_answer(q_id: int, body: AnswerSubmit):
    """Save a user's answer to a question."""
    async with get_db() as db:
        async with db.execute(
            "SELECT id FROM interview_questions WHERE id = ?", (q_id,)
        ) as cur:
            if not await cur.fetchone():
                raise HTTPException(404, "Question not found")
        await db.execute(
            "UPDATE interview_questions SET user_answer = ?, updated_at = datetime('now') WHERE id = ?",
            (body.answer, q_id),
        )
        await db.commit()
    return {"ok": True}


@router.post("/questions/{q_id}/score")
async def score_answer(q_id: int):
    """AI-score the stored answer using STAR framework."""
    async with get_db() as db:
        async with db.execute(
            """SELECT iq.id, iq.question, iq.user_answer, iq.question_type,
                      a.job_description, a.job_title
               FROM interview_questions iq
               JOIN applications a ON iq.application_id = a.id
               WHERE iq.id = ?""",
            (q_id,),
        ) as cur:
            row = await cur.fetchone()

    if not row:
        raise HTTPException(404, "Question not found")
    if not row["user_answer"]:
        raise HTTPException(422, "No answer to score — submit an answer first")

    async with get_db() as db:
        provider = await AIProvider.from_db(db)

    job_context = f"{row['job_title'] or ''}\n{(row['job_description'] or '')[:400]}"
    feedback = await score_star_answer(
        provider, row["question"], row["user_answer"], job_context
    )

    async with get_db() as db:
        await db.execute(
            "UPDATE interview_questions SET ai_score = ?, ai_feedback = ?, updated_at = datetime('now') WHERE id = ?",
            (feedback.get("score", 0), json.dumps(feedback), q_id),
        )
        await db.commit()

    return feedback


@router.delete("/questions/{q_id}")
async def delete_question(q_id: int):
    async with get_db() as db:
        await db.execute("DELETE FROM interview_questions WHERE id = ?", (q_id,))
        await db.commit()
    return {"ok": True}


@router.get("/{app_id}/answer-bank")
async def get_answer_bank(app_id: int):
    """All scored answers for an application."""
    async with get_db() as db:
        async with db.execute(
            """SELECT id, question, question_type, user_answer, ai_score, ai_feedback, created_at
               FROM interview_questions
               WHERE application_id = ? AND user_answer IS NOT NULL
               ORDER BY ai_score DESC NULLS LAST""",
            (app_id,),
        ) as cur:
            rows = await cur.fetchall()

    result = []
    for r in rows:
        d = dict(r)
        if d.get("ai_feedback"):
            try:
                d["ai_feedback"] = json.loads(d["ai_feedback"])
            except Exception:
                pass
        result.append(d)
    return result
