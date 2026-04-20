"""
Upload Routes — Firebase Storage
POST /upload/answer-sheet   — upload student answer sheet OR paste text
POST /upload/question-paper — upload question paper
POST /upload/textbook       — upload textbook PDF (triggers RAG indexing)
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from routes.auth import verify_token
from services.ocr_service import extract_text_from_bytes
from services.pdf_parser import pdf_bytes_to_text
from knowledge.knowledge_base import build as build_knowledge_base
from firebase_admin import firestore, storage
from utils.logger import get_logger
import uuid, os

log = get_logger(__name__)
router = APIRouter()


def db():
    return firestore.client()


def upload_to_firebase(data: bytes, path: str, content_type: str) -> str:
    """Upload bytes to Firebase Storage and return public URL."""
    bucket = storage.bucket()
    blob = bucket.blob(path)
    blob.upload_from_string(data, content_type=content_type)
    blob.make_public()
    return blob.public_url


# ── Upload answer sheet ──
@router.post("/answer-sheet")
async def upload_sheet(
    forum_id: str = Form(...),
    student_name: str = Form(...),
    reg_number: str = Form(...),
    file: UploadFile = File(None),
    text: str = Form(""),
    p=Depends(verify_token),
):
    """Upload answer sheet OR paste answer text directly.

    Priority:
      1. If 'text' param provided → use directly (bypass OCR)
      2. If 'file' provided → OCR then store
    """
    input_text = ""
    url = ""

    # Determine input source
    if text and len(text.strip()) >= 10:
        # Direct text paste - bypass OCR
        log.info(f"Using direct text input for student: {student_name}")
        input_text = text.strip()
        url = "[text-input]"
    elif file:
        # File upload - needs OCR
        data = await file.read()
        if len(data) > 20 * 1024 * 1024:
            raise HTTPException(400, "Max 20MB per sheet")

        ext = file.filename.split(".")[-1].lower()

        # Upload to Firebase Storage
        path = f"answer-sheets/{forum_id}/{reg_number}_{uuid.uuid4().hex[:8]}.{ext}"
        mime = file.content_type or (
            "application/pdf" if ext == "pdf" else "image/jpeg"
        )
        url = upload_to_firebase(data, path, mime)

        # OCR — extract text
        if ext == "pdf":
            input_text = pdf_bytes_to_text(data)
        else:
            input_text = await extract_text_from_bytes(data)

        log.info(f"OCR extracted {len(input_text)} chars for {student_name}")
    else:
        raise HTTPException(400, "Provide either 'file' or 'text' parameter")

    if not input_text:
        raise HTTPException(400, "Could not extract text. Try pasting directly.")

    # Save student to Firestore
    student_id = str(uuid.uuid4())
    student = {
        "forum_id": forum_id,
        "name": student_name,
        "reg_number": reg_number,
        "sheet_url": url,
        "ocr_text": input_text,
        "scores": {},
        "total": 0,
        "percentage": 0,
        "feedback": "",
        "status": "pending",
        "uploaded_by": p["uid"],
        "created_at": __import__("datetime").datetime.utcnow().isoformat(),
    }
    db().collection("students").document(student_id).set(student)
    student["id"] = student_id

    return {
        "success": True,
        "data": {
            "student": student,
            "ocr_preview": input_text[:500] if input_text else "No text extracted",
        },
    }


# ── Upload question paper ──
@router.post("/question-paper")
async def upload_paper(
    forum_id: str = Form(...), file: UploadFile = File(...), p=Depends(verify_token)
):
    data = await file.read()
    ext = file.filename.split(".")[-1].lower()
    path = f"question-papers/{forum_id}/{uuid.uuid4().hex[:8]}.{ext}"
    mime = file.content_type or "application/pdf"
    url = upload_to_firebase(data, path, mime)
    db().collection("forums").document(forum_id).update({"question_paper_url": url})
    return {"success": True, "data": {"url": url}}


# ── Upload textbook (triggers RAG indexing) ──
@router.post("/textbook")
async def upload_tb(
    forum_id: str = Form(...), file: UploadFile = File(...), p=Depends(verify_token)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Textbook must be a PDF file")
    data = await file.read()
    if len(data) > 100 * 1024 * 1024:
        raise HTTPException(400, "Max 100MB for textbook")

    # Upload to Firebase Storage
    path = f"textbooks/{forum_id}/{uuid.uuid4().hex[:8]}.pdf"
    url = upload_to_firebase(data, path, "application/pdf")
    db().collection("forums").document(forum_id).update({"textbook_url": url})

    # Index into ChromaDB for RAG
    import tempfile

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name

    chunk_count, msg = build_knowledge_base(tmp_path, force_rebuild=True)
    import os

    os.unlink(tmp_path)

    return {
        "success": True,
        "data": {"url": url, "chunks_indexed": chunk_count, "message": msg},
    }
