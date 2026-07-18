"""Document → partial StudentProfile. The ONLY place the OpenAI API is touched.

Per CLAUDE.md: doc parsing is isolated here so the provider/model can be swapped
by editing one function. PDFs go through pdfplumber (text layer); images go
through gpt-4o-mini vision. Output is a *partial* StudentProfile dict containing
only fields the document actually evidences — the merge happens in intake.py.
"""
import base64
import io
import json
import mimetypes
from pathlib import Path

from openai import OpenAI

MODEL = "gpt-4o-mini"
SCHEMA_PATH = Path(__file__).resolve().parents[2] / "schemas" / "student-profile.schema.json"

DOC_HINTS = {
    "transcript": "an academic transcript or marksheet. Extract last_qualification: level "
    "(matric | intermediate | a_levels | bachelors | other — FA/FSc/ICS/ICom count as intermediate), "
    "grades (verbatim, with marks/total if printed), year_completed, institution.",
    "ielts_trf": "an IELTS Test Report Form. Extract english_test: status='taken', "
    "test_type ('ielts_ukvi' if the form says UKVI, else 'ielts_academic'), overall_score (the Overall Band Score), "
    "test_date (ISO date).",
    "bank_statement": "a bank statement. Extract budget.bank_statement_capacity_pkr (closing balance in PKR) "
    "and, if the account holder is named, budget.sponsor.",
    "existing_quote": "a quote from another consultancy. Summarise every fee line with its amount into notes, verbatim figures.",
    "other": "a supporting document. Extract only StudentProfile fields it clearly evidences.",
}


def _system_prompt(doc_type: str) -> str:
    schema = SCHEMA_PATH.read_text(encoding="utf-8")
    return (
        "You extract data from a Pakistani student's study-abroad document into a PARTIAL StudentProfile.\n"
        f"The document is {DOC_HINTS.get(doc_type, DOC_HINTS['other'])}\n\n"
        "Rules:\n"
        "- Output a single JSON object containing ONLY the StudentProfile fields the document evidences. "
        "Omit every field you cannot read from the document — never guess, never fill defaults.\n"
        "- Never include: profile_id, confirmed, frozen_at, documents_provided.\n"
        "- Follow the field shapes in this JSON Schema exactly:\n\n" + schema
    )


def parse_document(data: bytes, filename: str, doc_type: str) -> dict:
    """Return the partial StudentProfile evidenced by one uploaded document."""
    suffix = Path(filename).suffix.lower()
    if suffix == ".pdf":
        import pdfplumber

        with pdfplumber.open(io.BytesIO(data)) as pdf:
            text = "\n".join(page.extract_text() or "" for page in pdf.pages).strip()
        if not text:
            raise ValueError("PDF has no text layer (scanned?) — upload a photo/screenshot of it instead")
        user_content = [{"type": "text", "text": f"Document text:\n\n{text[:15000]}"}]
    elif suffix in {".png", ".jpg", ".jpeg", ".webp"}:
        mime = mimetypes.types_map.get(suffix, "image/png")
        data_url = f"data:{mime};base64,{base64.b64encode(data).decode()}"
        user_content = [
            {"type": "text", "text": "Extract the profile fields from this document image."},
            {"type": "image_url", "image_url": {"url": data_url}},
        ]
    else:
        raise ValueError(f"unsupported file type '{suffix}' — use PDF, PNG, JPG or WEBP")

    client = OpenAI()
    resp = client.chat.completions.create(
        model=MODEL,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": _system_prompt(doc_type)},
            {"role": "user", "content": user_content},
        ],
        temperature=0,
    )
    return json.loads(resp.choices[0].message.content)
