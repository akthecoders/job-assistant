"""PDF parsing (pdfminer) and PDF generation/editing (pymupdf + reportlab)."""
from io import BytesIO
import re


# ── Text extraction from uploaded PDF ────────────────────────────────────────

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    from pdfminer.high_level import extract_text as _extract
    return _extract(BytesIO(pdf_bytes)).strip()


# ── In-place PDF editing via PyMuPDF ─────────────────────────────────────────

def _get_span_fontsize(blocks: list, rect) -> float | None:
    """Return the font size of the first span that overlaps the given rect."""
    import fitz
    r = fitz.Rect(rect)
    for block in blocks:
        if block.get("type") != 0:  # 0 = text block
            continue
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                sr = fitz.Rect(span["bbox"])
                if sr.intersects(r):
                    return span["size"]
    return None


def edit_pdf_in_place(pdf_bytes: bytes, changes: list[dict]) -> bytes:
    """
    Apply a list of {"from": "...", "to": "..."} text substitutions directly
    inside the original PDF, preserving all layout, fonts, and formatting.
    Returns the modified PDF bytes.
    """
    import fitz

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    for page in doc:
        text_dict = page.get_text("dict")
        blocks = text_dict.get("blocks", [])

        for change in changes:
            old = change.get("from", "").strip()
            new = change.get("to", "").strip()
            if not old or old == new:
                continue

            # Search for exact match first, then relaxed (ignore extra spaces)
            instances = page.search_for(old)
            if not instances:
                instances = page.search_for(old, flags=fitz.TEXT_INHIBIT_SPACES)
            if not instances:
                continue

            for rect in instances:
                fontsize = _get_span_fontsize(blocks, rect) or 10.0
                # Redact the old text (white it out) and write new text in place
                page.add_redact_annot(
                    rect,
                    text=new,
                    fontname="helv",
                    fontsize=fontsize,
                    align=fitz.TEXT_ALIGN_LEFT,
                )

        page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)

    result = bytes(doc.tobytes(deflate=True))
    doc.close()
    return result


# ── Resume line classification ────────────────────────────────────────────────

def _classify_line(line: str, is_first: bool) -> str:
    s = line.strip()
    if not s:
        return 'blank'
    if is_first:
        return 'name'
    if s == s.upper() and len(s) >= 3 and len(s) <= 60 and re.search(r'[A-Z]', s):
        return 'section'
    if re.match(r'^[\-\*\•\–\▸\◦]\s', s):
        return 'bullet'
    if re.search(r'[@|•]|linkedin\.com|github\.com|\+?\d[\d\s\-]{7,}', s, re.I):
        return 'contact'
    return 'body'


# ── PDF generation from plain text (fallback / new resumes) ──────────────────

def generate_pdf(text: str, title: str = "Resume") -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.enums import TA_LEFT
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
    from reportlab.lib import colors

    MARGIN = 18 * mm

    lines = text.splitlines()
    non_blank = [l for l in lines if l.strip()]
    line_count = len(non_blank)

    if line_count <= 35:
        base = 10.0
    elif line_count <= 50:
        base = 9.5
    elif line_count <= 65:
        base = 9.0
    elif line_count <= 80:
        base = 8.5
    else:
        base = 8.0

    leading = base * 1.30
    section_size = base + 0.5
    name_size = base + 5

    INK  = colors.HexColor("#1a1a1a")
    BLUE = colors.HexColor("#1d4ed8")
    GRAY = colors.HexColor("#64748b")

    name_style = ParagraphStyle("name", fontName="Helvetica-Bold",
        fontSize=name_size, leading=name_size * 1.2, textColor=INK, spaceAfter=1)
    contact_style = ParagraphStyle("contact", fontName="Helvetica",
        fontSize=base - 0.5, leading=(base - 0.5) * 1.3, textColor=GRAY, spaceAfter=4)
    section_style = ParagraphStyle("section", fontName="Helvetica-Bold",
        fontSize=section_size, leading=section_size * 1.25, textColor=BLUE,
        spaceBefore=7, spaceAfter=1)
    bullet_style = ParagraphStyle("bullet", fontName="Helvetica",
        fontSize=base, leading=leading, textColor=INK,
        leftIndent=10, spaceAfter=0.5)
    body_style = ParagraphStyle("body", fontName="Helvetica",
        fontSize=base, leading=leading, textColor=INK, spaceAfter=0.5)

    def esc(s: str) -> str:
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    story = []
    first_content_seen = False

    for line in lines:
        stripped = line.strip()
        kind = _classify_line(stripped, not first_content_seen and bool(stripped))

        if kind == 'blank':
            story.append(Spacer(1, 2))
            continue

        first_content_seen = True
        safe = esc(stripped)

        if kind == 'name':
            story.append(Paragraph(safe, name_style))
        elif kind == 'contact':
            story.append(Paragraph(safe, contact_style))
        elif kind == 'section':
            story.append(HRFlowable(width="100%", thickness=0.5,
                color=colors.HexColor("#cbd5e1"), spaceAfter=2, spaceBefore=2))
            story.append(Paragraph(safe, section_style))
        elif kind == 'bullet':
            body = re.sub(r'^[\-\*\•\–\▸\◦]\s*', '', stripped)
            story.append(Paragraph(f"• {esc(body)}", bullet_style))
        else:
            story.append(Paragraph(safe, body_style))

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN, bottomMargin=MARGIN, title=title)
    doc.build(story)
    return buf.getvalue()
