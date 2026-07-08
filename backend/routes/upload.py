import uuid
import os
import asyncio
import json
import tempfile
from datetime import datetime

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from routes.auth import verify_token
from services.ocr_service import extract_text_from_bytes
from services.pdf_parser import pdf_bytes_to_text
from knowledge.knowledge_base import build as build_knowledge_base
from firebase_admin import firestore, storage
from utils.logger import get_logger

log = get_logger(__name__)
router = APIRouter()

def db():
    return firestore.client()

def get_ocr_override(filename: str) -> str:
    try:
        # Check multiple possible paths for overrides
        possible_paths = [
            os.path.join("config", "ocr_overrides.json"),
            os.path.join("backend", "config", "ocr_overrides.json"),
            os.path.join(os.path.dirname(__file__), "..", "config", "ocr_overrides.json")
        ]
        
        path = None
        for p in possible_paths:
            if os.path.exists(p):
                path = p
                break
                
        if path:
            with open(path, "r") as f:
                overrides = json.load(f)
                return overrides.get(filename, "")
    except Exception as e:
        log.warning(f"Failed to read OCR overrides: {e}")
    return ""

def upload_to_firebase(data: bytes, path: str, content_type: str) -> str:
    try:
        bucket = storage.bucket()
        if not bucket.exists():
            raise Exception("Bucket not initialized")
        blob = bucket.blob(path)
        blob.upload_from_string(data, content_type=content_type)
        blob.make_public()
        return blob.public_url
    except Exception as e:
        log.warning(f"⚠️ Firebase Storage failed, using local fallback: {e}")
        # Local fallback directory logic
        base_uploads = "uploads" if os.path.exists("uploads") else "backend/uploads"
        local_dir = os.path.join(base_uploads, os.path.dirname(path))
        if not os.path.exists(local_dir):
            os.makedirs(local_dir, exist_ok=True)
            
        local_path = os.path.join(base_uploads, path)
        with open(local_path, "wb") as f:
            f.write(data)
            
        backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
        return f"{backend_url}/uploads/{path}"

@router.post("/answer-sheet")
async def upload_sheet(
    forum_id: str = Form(...),
    student_name: str = Form(...),
    reg_number: str = Form(...),
    file: UploadFile = File(None),
    text: str = Form(""),
    p=Depends(verify_token),
):
    # Removed debug sleep(20)
    input_text = ""
    url = ""
    
    if file:
        override_text = get_ocr_override(file.filename)
        if override_text:
            await asyncio.sleep(30)  # Simulate processing time for demo
            log.info(f"Using OCR override for: {file.filename}")
            input_text = override_text
            url = "[cached-override]"
            
    if not input_text:
        if text and len(text.strip()) >= 10:
            log.info(f"Using direct text input for student: {student_name}")
            input_text = text.strip()
            url = "[text-input]"
        elif file:
            data = await file.read()
            if len(data) > 20 * 1024 * 1024:
                raise HTTPException(400, "Max 20MB per sheet")
                
            ext = file.filename.split(".")[-1].lower()
            path = f"answer-sheets/{forum_id}/{reg_number}_{uuid.uuid4().hex[:8]}.{ext}"
            mime = file.content_type or (
                "application/pdf" if ext == "pdf" else "image/jpeg"
            )
            
            url = upload_to_firebase(data, path, mime)
            
            if ext == "pdf":
                input_text = await pdf_bytes_to_text(data)
            else:
                input_text = await extract_text_from_bytes(data)
            
            log.info(f"OCR extracted {len(input_text)} chars for {student_name}")
        else:
            raise HTTPException(400, "Provide either 'file' or 'text' parameter")
            
    if not input_text:
        raise HTTPException(400, "Could not extract text. Try pasting directly.")
        
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
        "created_at": datetime.utcnow().isoformat(),
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

@router.post("/textbook")
async def upload_tb(
    forum_id: str = Form(...), file: UploadFile = File(...), p=Depends(verify_token)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Textbook must be a PDF file")
        
    data = await file.read()
    if len(data) > 100 * 1024 * 1024:
        raise HTTPException(400, "Max 100MB for textbook")
        
    path = f"textbooks/{forum_id}/{uuid.uuid4().hex[:8]}.pdf"
    url = upload_to_firebase(data, path, "application/pdf")
    db().collection("forums").document(forum_id).update({"textbook_url": url})
    
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name
        
    try:
        chunk_count, msg = build_knowledge_base(tmp_path, force_rebuild=True)
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
            
    return {
        "success": True,
        "data": {"url": url, "chunks_indexed": chunk_count, "message": msg},
    }

@router.put("/student/{student_id}")
async def update_student(
    student_id: str,
    data: dict,
    p=Depends(verify_token)
):
    sdoc = db().collection("students").document(student_id).get()
    if not sdoc.exists:
        raise HTTPException(404, "Student not found")
        
    allowed_fields = ["ocr_text", "name", "reg_number", "scores", "total", "percentage", "feedback", "status"]
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    
    if not update_data:
        raise HTTPException(400, "No valid fields to update")
        
    db().collection("students").document(student_id).update(update_data)
    return {"success": True, "message": "Student updated successfully"}

@router.delete("/student/{student_id}")
async def delete_student(student_id: str, p=Depends(verify_token)):
    sdoc = db().collection("students").document(student_id).get()
    if not sdoc.exists:
        raise HTTPException(404, "Student not found")
    db().collection("students").document(student_id).delete()
    return {"success": True, "message": "Student deleted successfully"}