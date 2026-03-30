import json
import re
from services.ai_provider import AIProvider

QUESTION_GEN_PROMPT = """You are an expert interview coach preparing a candidate for a job interview.
Given the job description, generate realistic interview questions that would likely be asked.

Return ONLY a JSON array of question objects:
[
  {
    "question": "<full question text>",
    "question_type": "<behavioral|technical|situational>",
    "why_asked": "<1 sentence: what the interviewer is assessing>"
  },
  ...
]

Question type definitions:
- behavioral: Past experience questions ("Tell me about a time when...")
- technical: Skills/knowledge questions specific to the role
- situational: Hypothetical scenario questions ("How would you handle...")

Rules:
- Generate exactly the number of questions requested
- Make questions specific to the actual job requirements, not generic
- Distribute types based on role: engineering roles get more technical, leadership roles more behavioral
- Output ONLY valid JSON array, no markdown, no commentary"""

STAR_SCORE_PROMPT = """You are an expert interview coach evaluating a candidate's answer.

Job context: {job_context}
Question: {question}
Candidate's answer: {answer}

Score this answer using the STAR framework (Situation, Task, Action, Result).

Return ONLY a JSON object:
{{
  "score": <integer 0-100>,
  "star_breakdown": {{
    "situation": "<assessment of how well situation was set up, or 'Missing'>",
    "task": "<assessment of task/challenge clarity, or 'Missing'>",
    "action": "<assessment of actions described, or 'Missing'>",
    "result": "<assessment of result/outcome, or 'Missing'>"
  }},
  "strengths": ["<specific strength 1>", "<strength 2>"],
  "improvements": ["<specific improvement 1>", "<improvement 2>"],
  "overall_feedback": "<2-3 sentence overall assessment>"
}}

Scoring guide:
- 90-100: Excellent STAR structure, specific, quantified results
- 70-89: Good structure, clear actions, could add more metrics
- 50-69: Partial STAR, missing some components
- Below 50: Weak structure, too vague, or missing key elements

Output ONLY valid JSON, no markdown."""


async def generate_questions(
    provider: AIProvider,
    job_description: str,
    job_title: str = "",
    types: list[str] = None,
    count: int = 8,
) -> list[dict]:
    if types is None:
        types = ["behavioral", "technical", "situational"]

    type_str = ", ".join(types)
    user_msg = (
        f"Job Title: {job_title}\n\n"
        f"Job Description:\n{job_description}\n\n"
        f"Generate {count} questions. Include types: {type_str}."
    )

    raw = await provider.complete(QUESTION_GEN_PROMPT, user_msg)
    cleaned = re.sub(r"```(?:json)?", "", raw).strip().rstrip("```").strip()

    try:
        result = json.loads(cleaned)
        if isinstance(result, list):
            return result
    except json.JSONDecodeError:
        match = re.search(r"\[.*\]", cleaned, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except Exception:
                pass
    return []


async def score_star_answer(
    provider: AIProvider,
    question: str,
    answer: str,
    job_context: str = "",
) -> dict:
    prompt = STAR_SCORE_PROMPT.format(
        job_context=job_context[:500] if job_context else "Not provided",
        question=question,
        answer=answer,
    )
    raw = await provider.complete("You are an expert interview evaluator.", prompt)
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
        "score": 0,
        "star_breakdown": {
            "situation": "N/A",
            "task": "N/A",
            "action": "N/A",
            "result": "N/A",
        },
        "strengths": [],
        "improvements": ["Could not analyze answer — try again."],
        "overall_feedback": "Analysis failed.",
    }
