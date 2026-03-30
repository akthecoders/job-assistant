from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
import json
from database import get_db
from services.pdf_utils import extract_text_from_pdf, generate_pdf

router = APIRouter(prefix="/api/resumes", tags=["resumes"])


class ResumeCreate(BaseModel):
    name: str
    content: str
    is_default: bool = False
    pdf_b64: Optional[str] = None  # base64-encoded original PDF bytes


class ResumeUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    is_default: Optional[bool] = None


# ── PDF / static endpoints MUST come before /{resume_id} routes ───────────────

@router.post("/parse-pdf")
async def parse_pdf(file: UploadFile = File(...)):
    """Extract text from an uploaded PDF resume. Returns text + a temp PDF token."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are accepted")
    raw = await file.read()
    if len(raw) > 10 * 1024 * 1024:  # 10 MB limit
        raise HTTPException(400, "PDF too large (max 10 MB)")
    try:
        text = extract_text_from_pdf(raw)
    except Exception as e:
        raise HTTPException(422, f"Could not parse PDF: {e}")
    if not text.strip():
        raise HTTPException(422, "No text could be extracted from this PDF")
    # Encode PDF bytes as base64 so frontend can pass them back when saving
    import base64
    return {"text": text, "pdf_b64": base64.b64encode(raw).decode()}


class AiParseRequest(BaseModel):
    text: str


@router.post("/ai-parse")
async def ai_parse_resume(req: AiParseRequest):
    """Use AI to clean up and structure raw resume text extracted from a PDF."""
    if not req.text.strip():
        raise HTTPException(400, "text is required")
    from services.ai_provider import AIProvider
    async with get_db() as db:
        provider = await AIProvider.from_db(db)
    system = (
        "You are an expert resume formatter. "
        "The user will give you raw text extracted from a PDF resume (which may have garbled spacing, merged words, or formatting issues from the PDF parser). "
        "Your job is to:\n"
        "1. Fix any OCR/parsing artefacts (merged words, broken lines, extra whitespace)\n"
        "2. Organise the content into clear sections (Contact, Summary, Experience, Education, Skills, etc.)\n"
        "3. Preserve ALL original information — do not add, invent, or remove any facts\n"
        "4. Use plain text only — no markdown symbols like ** or ##\n"
        "5. Section headers should be in ALL CAPS (e.g. EXPERIENCE, EDUCATION)\n"
        "Output only the cleaned resume text, no commentary."
    )
    try:
        cleaned = await provider.complete(system, req.text)
    except Exception as e:
        raise HTTPException(502, f"AI provider error: {e}")
    return {"text": cleaned.strip()}


class RawTextPdfRequest(BaseModel):
    text: str
    filename: str = "Resume"


@router.post("/download-pdf")
async def download_pdf_from_text(req: RawTextPdfRequest):
    """Generate a PDF from raw text (used by the extension before saving)."""
    if not req.text.strip():
        raise HTTPException(400, "text is required")
    pdf_bytes = generate_pdf(req.text, title=req.filename)
    safe_name = req.filename.replace(" ", "_").replace("/", "-")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.pdf"'},
    )


# ── CRUD endpoints ─────────────────────────────────────────────────────────────

@router.get("")
async def list_resumes():
    async with get_db() as db:
        async with db.execute(
            "SELECT id, name, is_default, created_at, substr(content, 1, 200) as preview FROM resumes ORDER BY created_at DESC"
        ) as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]


@router.post("", status_code=201)
async def create_resume(payload: ResumeCreate):
    import base64
    pdf_bytes = None
    if payload.pdf_b64:
        try:
            pdf_bytes = base64.b64decode(payload.pdf_b64)
        except Exception:
            pass
    async with get_db() as db:
        if payload.is_default:
            await db.execute("UPDATE resumes SET is_default = 0")
        async with db.execute(
            "INSERT INTO resumes (name, content, is_default, pdf_bytes) VALUES (?, ?, ?, ?) RETURNING id",
            (payload.name, payload.content, int(payload.is_default), pdf_bytes),
        ) as cur:
            row = await cur.fetchone()
        await db.commit()
    return {"id": row[0]}


@router.get("/{resume_id}")
async def get_resume(resume_id: int):
    async with get_db() as db:
        async with db.execute(
            "SELECT id, name, content, is_default, created_at FROM resumes WHERE id = ?",
            (resume_id,)
        ) as cur:
            row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Resume not found")
    return dict(row)


@router.put("/{resume_id}")
async def update_resume(resume_id: int, payload: ResumeUpdate):
    async with get_db() as db:
        async with db.execute(
            "SELECT id FROM resumes WHERE id = ?", (resume_id,)
        ) as cur:
            if not await cur.fetchone():
                raise HTTPException(404, "Resume not found")
        if payload.is_default:
            await db.execute("UPDATE resumes SET is_default = 0")
        updates = {k: v for k, v in payload.model_dump().items() if v is not None}
        if updates:
            cols = ", ".join(f"{k} = ?" for k in updates)
            await db.execute(
                f"UPDATE resumes SET {cols} WHERE id = ?",
                (*updates.values(), resume_id),
            )
        await db.commit()
    return {"ok": True}


@router.delete("/{resume_id}")
async def delete_resume(resume_id: int):
    async with get_db() as db:
        await db.execute("DELETE FROM resumes WHERE id = ?", (resume_id,))
        await db.commit()
    return {"ok": True}


@router.get("/{resume_id}/pdf")
async def download_resume_pdf(resume_id: int):
    """Return the original stored PDF if available, otherwise generate one."""
    async with get_db() as db:
        async with db.execute(
            "SELECT name, content, pdf_bytes FROM resumes WHERE id = ?", (resume_id,)
        ) as cur:
            row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Resume not found")
    safe_name = row["name"].replace(" ", "_").replace("/", "-")
    if row["pdf_bytes"]:
        pdf_out = bytes(row["pdf_bytes"])
    else:
        pdf_out = generate_pdf(row["content"], title=row["name"])
    return Response(
        content=pdf_out,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.pdf"'},
    )


class TailoredPdfRequest(BaseModel):
    tailored_text: str
    filename: str = "Tailored_Resume"


@router.post("/{resume_id}/tailored-pdf")
async def download_tailored_pdf(resume_id: int, req: TailoredPdfRequest):
    """Edit the original stored PDF in-place with the tailored text changes.
    Falls back to generating a new PDF if no original is stored."""
    async with get_db() as db:
        async with db.execute(
            "SELECT name, content, pdf_bytes FROM resumes WHERE id = ?", (resume_id,)
        ) as cur:
            row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Resume not found")

    safe_name = req.filename.replace(" ", "_").replace("/", "-")

    pdf_out = generate_pdf(req.tailored_text, title=req.filename)

    return Response(
        content=pdf_out,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.pdf"'},
    )


