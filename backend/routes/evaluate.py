from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from routes.auth import verify_token
from services.ocr_service import extract_text_from_bytes
from knowledge.knowledge_base import retrieve as retrieve_context_advanced
from firebase_admin import firestore
from grading.grader import clear_cache
import json, re, datetime
router = APIRouter()
def db():
    return firestore.client()
class EvalReq(BaseModel):
    student_id: str
    forum_id: str
class EvalAllReq(BaseModel):
    forum_id: str
def extract_q_answer(ocr_text: str, qnum: int, total_q: int) -> str:
    if not ocr_text:
        return ""
    if total_q == 1 and len(ocr_text.strip()) > 0:
        marker_patterns = [rf"Q\.?\s*{qnum}", rf"\b{qnum}[\.\)]", rf"Question\s*{qnum}", rf"Ans\s*{qnum}"]
        has_marker = any(re.search(p, ocr_text, re.I) for p in marker_patterns)
        if not has_marker:
            return ocr_text.strip()
    curr_markers = [rf"Q\.?\s*{qnum}[:\.\)]?", rf"\b{qnum}[:\.\)]", rf"Question\s*{qnum}[:\.]?", rf"Ans\s*{qnum}[:\.]?"]
    next_markers = [rf"Q\.?\s*{qnum+1}[:\.\)]?", rf"\b{qnum+1}[:\.\)]", rf"Question\s*{qnum+1}[:\.]?", rf"Ans\s*{qnum+1}[:\.]?"]
    curr_re = "|".join(curr_markers)
    next_re = "|".join(next_markers)
    if qnum < total_q:
        pattern = rf"(?:{curr_re})\s*(.*?)(?={next_re})"
    else:
        pattern = rf"(?:{curr_re})\s*(.*?)$"
    m = re.search(pattern, ocr_text, re.IGNORECASE | re.DOTALL)
    if m and m.group(1).strip():
        return m.group(1).strip()
    lines = ocr_text.split("\n")
    capture = False
    result = []
    for line in lines:
        if any(re.match(rf"^\s*{p}\b", line, re.IGNORECASE) for p in curr_markers):
            capture = True
            clean_line = line
            for p in curr_markers:
                clean_line = re.sub(rf"^\s*{p}\s*", "", clean_line, flags=re.IGNORECASE)
            if clean_line.strip():
                result.append(clean_line.strip())
            continue
        if capture:
            if any(re.match(rf"^\s*{p}\b", line, re.IGNORECASE) for p in next_markers):
                break
            result.append(line)
    return "\n".join(result).strip() if result else ""
@router.post("/student")
async def evaluate_student(req: EvalReq, p=Depends(verify_token)):
    sdoc = db().collection("students").document(req.student_id).get()
    if not sdoc.exists:
        raise HTTPException(404, "Student not found")
    student = sdoc.to_dict()
    fdoc = db().collection("forums").document(req.forum_id).get()
    if not fdoc.exists:
        raise HTTPException(404, "Forum not found")
    forum = fdoc.to_dict()
    answers = []
    for a in db().collection("model_answers").where("forum_id", "==", req.forum_id).stream():
        answers.append(a.to_dict())
    answers.sort(key=lambda x: int(x.get("question_num", 0)))
    if not answers:
        raise HTTPException(400, "No model answers found for this forum")
    ocr_text = student.get("ocr_text", "")
    total_q = len(answers)
    scores = {}
    total = 0
    feedbacks = []
    batch_input = []
    for qa in answers:
        qnum = qa["question_num"]
        student_ans = extract_q_answer(ocr_text, qnum, total_q)
        context_chunks = retrieve_context_advanced(qa["answer_text"], top_k=3)
        context = "\n\n".join(context_chunks) if context_chunks else qa["answer_text"]
        kw = qa.get("keywords", "")
        keywords = [k.strip() for k in kw.split(",") if k.strip()] if isinstance(kw, str) else kw
        batch_input.append({
            "question": qa["question_text"],
            "student_answer": student_ans,
            "reference_context": context,
            "max_marks": int(qa["marks"]),
            "qnum": qnum
        })
    from grading.grader import grade_student_batch
    batch_results = grade_student_batch(batch_input)
    scores = {}
    total = 0
    feedbacks = []
    for i, res in enumerate(batch_results):
        qnum = batch_input[i]["qnum"]
        scores[f"Q{qnum}"] = res["marks_awarded"]
        total += res["marks_awarded"]
        feedbacks.append(f"Q{qnum}: {res.get('feedback', '')}")
    pct = round((total / max(forum.get("total_marks", 100), 1)) * 100, 1)
    feedback_text = " | ".join(feedbacks)
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
@router.post("/all")
async def evaluate_all(req: EvalAllReq, p=Depends(verify_token)):
    db().collection("forums").document(req.forum_id).update({"status": "grading"})
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
    db().collection("forums").document(req.forum_id).update({"status": "active"})
    return {
        "success": True,
        "data": {
            "evaluated": len(results),
            "results": results
        }
    }