"""
Evaluate Routes — Groq LLM + ChromaDB RAG + AutomaticGrader Modules
POST /evaluate/student  — grade one student
POST /evaluate/all      — grade all students in a forum
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from routes.auth import verify_token
from services.ocr_service import extract_text_from_bytes
from knowledge.knowledge_base import retrieve as retrieve_context_advanced
from firebase_admin import firestore
from grading.grader import grade as advanced_grade
from grading.grader import clear_cache
import json, re, datetime

def grade_answer_simple(student_ans, model_ans, keywords, max_marks, context=""):
    """Wrapper using the new grading module"""
    result = advanced_grade(
        question=f"Answer question ({max_marks} marks)",
        student_answer=student_ans,
        reference_context=context or model_ans,
        max_marks=max_marks
    )
    return {
        "score": result.get("marks_awarded", 0),
        "feedback": result.get("feedback", ""),
        "missing": ", ".join(result.get("points_missing", []))
    }

router = APIRouter()

def db():
    return firestore.client()

class EvalReq(BaseModel):
    student_id: str
    forum_id: str

class EvalAllReq(BaseModel):
    forum_id: str

def extract_q_answer(ocr_text: str, qnum: int, total_q: int) -> str:
    """Extract answer for question N from OCR text."""
    if not ocr_text:
        return ""
    # Try Q1: ... Q2: pattern
    if qnum < total_q:
        pattern = rf"Q\.?\s*{qnum}[:\.\)]\s*(.*?)(?=Q\.?\s*{qnum+1}[:\.\)])"
    else:
        pattern = rf"Q\.?\s*{qnum}[:\.\)]\s*(.*?)$"
    m = re.search(pattern, ocr_text, re.IGNORECASE | re.DOTALL)
    if m:
        return m.group(1).strip()
    # Fallback: split by lines, try to find Q marker
    lines = ocr_text.split("\n")
    capture = False
    result = []
    for line in lines:
        if re.match(rf"^\s*Q\.?\s*{qnum}\b", line, re.IGNORECASE):
            capture = True
            # Remove the Q header itself
            rest = re.sub(rf"^\s*Q\.?\s*{qnum}[:\.\)]\s*", "", line, flags=re.IGNORECASE)
            if rest.strip():
                result.append(rest.strip())
            continue
        if capture:
            if re.match(rf"^\s*Q\.?\s*{qnum+1}\b", line, re.IGNORECASE):
                break
            result.append(line)
    return "\n".join(result).strip() if result else ""

# ── Grade single student ──
@router.post("/student")
async def evaluate_student(req: EvalReq, p=Depends(verify_token)):
    # Get student
    sdoc = db().collection("students").document(req.student_id).get()
    if not sdoc.exists:
        raise HTTPException(404, "Student not found")
    student = sdoc.to_dict()

    # Get forum
    fdoc = db().collection("forums").document(req.forum_id).get()
    if not fdoc.exists:
        raise HTTPException(404, "Forum not found")
    forum = fdoc.to_dict()

    # Get model answers
    answers = []
    for a in db().collection("model_answers").where("forum_id", "==", req.forum_id).order_by("question_num").stream():
        answers.append(a.to_dict())

    if not answers:
        raise HTTPException(400, "No model answers found for this forum")

    ocr_text = student.get("ocr_text", "")
    total_q = len(answers)
    scores = {}
    total = 0
    feedbacks = []

    for qa in answers:
        qnum = qa["question_num"]
        student_ans = extract_q_answer(ocr_text, qnum, total_q)

        # RAG: retrieve relevant textbook chunks
        context_chunks = retrieve_context_advanced(qa["answer_text"], top_k=3)
        context = "\n\n".join(context_chunks) if context_chunks else qa["answer_text"]

        # Parse keywords
        kw = qa.get("keywords", "")
        keywords = [k.strip() for k in kw.split(",") if k.strip()] if isinstance(kw, str) else kw

        result = grade_answer_simple(
            student_ans=student_ans,
            model_ans=qa["answer_text"],
            keywords=keywords,
            max_marks=qa["marks"],
            context=context
        )
        scores[f"Q{qnum}"] = result["score"]
        total += result["score"]
        feedbacks.append(f"Q{qnum}: {result.get('feedback', '')}")

    pct = round((total / max(forum.get("total_marks", 100), 1)) * 100, 1)
    feedback_text = " | ".join(feedbacks)

    # Update student in Firestore
    db().collection("students").document(req.student_id).update({
        "scores": scores,
        "total": total,
        "percentage": pct,
        "feedback": feedback_text,
        "status": "graded",
        "graded_at": datetime.datetime.utcnow().isoformat()
    })

    return {
        "success": True,
        "data": {
            "student_id": req.student_id,
            "name": student.get("name", ""),
            "scores": scores,
            "total": total,
            "percentage": pct,
            "feedback": feedback_text
        }
    }

# ── Grade all students in a forum ──
@router.post("/all")
async def evaluate_all(req: EvalAllReq, p=Depends(verify_token)):
    # Update forum status to grading
    db().collection("forums").document(req.forum_id).update({"status": "grading"})

    # Get all students
    students = []
    for s in db().collection("students").where("forum_id", "==", req.forum_id).stream():
        sd = s.to_dict()
        sd["id"] = s.id
        students.append(sd)

    if not students:
        raise HTTPException(400, "No students found in this forum")

    results = []
    for s in students:
        try:
            r = await evaluate_student(
                EvalReq(student_id=s["id"], forum_id=req.forum_id), p
            )
            results.append({"id": s["id"], "status": "ok", **r.get("data", r)})
        except Exception as e:
            results.append({"id": s["id"], "status": "error", "detail": str(e)})

    # Update forum status
    db().collection("forums").document(req.forum_id).update({"status": "active"})

    return {
        "success": True,
        "data": {
            "evaluated": len(results),
            "results": results
        }
    }
