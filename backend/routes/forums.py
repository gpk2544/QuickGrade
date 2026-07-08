from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from routes.auth import verify_token
from firebase_admin import firestore
from typing import Optional, List
import datetime, uuid
router = APIRouter()
def db():
    return firestore.client()
class ModelAnswerItem(BaseModel):
    question_num: int
    question_text: str = ""
    answer_text: str
    keywords: str = ""
    marks: int = 10
    note: str = ""
class ForumReq(BaseModel):
    name: str
    subject: str
    class_name: str
    exam_date: Optional[str] = None
    total_marks: int = 100
    answers: List[ModelAnswerItem] = []
@router.get("/")
def list_forums(p=Depends(verify_token)):
    forums_ref = db().collection("forums")\
        .where("teacher_id", "==", p["uid"])\
        .stream()
    result = []
    for doc in forums_ref:
        f = doc.to_dict()
        f["id"] = doc.id
        students = list(db().collection("students").where("forum_id", "==", doc.id).stream())
        student_dicts = [s.to_dict() for s in students]
        f["student_count"] = len(student_dicts)
        graded = [s for s in student_dicts if s.get("status") == "graded"]
        f["graded_count"] = len(graded)
        totals = [s.get("total", 0) for s in graded]
        f["avg_score"] = round(sum(totals) / len(totals), 1) if totals else 0
        f["avg_pct"] = round((f["avg_score"] / max(f.get("total_marks", 100), 1)) * 100, 1) if totals else 0
        result.append(f)
    result.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return {"success": True, "data": result}
@router.post("/")
def create_forum(req: ForumReq, p=Depends(verify_token)):
    forum_id = str(uuid.uuid4())
    forum = {
        "teacher_id": p["uid"],
        "name": req.name,
        "subject": req.subject,
        "class_name": req.class_name,
        "exam_date": req.exam_date or "",
        "total_marks": req.total_marks,
        "status": "active",
        "question_paper_url": "",
        "textbook_url": "",
        "created_at": datetime.datetime.utcnow().isoformat()
    }
    db().collection("forums").document(forum_id).set(forum)
    forum["id"] = forum_id
    for a in req.answers:
        ans_id = str(uuid.uuid4())
        db().collection("model_answers").document(ans_id).set({
            "forum_id": forum_id,
            "question_num": a.question_num,
            "question_text": a.question_text,
            "answer_text": a.answer_text,
            "keywords": a.keywords,
            "marks": a.marks,
            "note": a.note
        })
    return {"success": True, "data": forum}
@router.get("/{forum_id}")
def get_forum(forum_id: str, p=Depends(verify_token)):
    doc = db().collection("forums").document(forum_id).get()
    if not doc.exists:
        raise HTTPException(404, "Forum not found")
    forum = doc.to_dict()
    forum["id"] = doc.id
    answers = []
    for a in db().collection("model_answers").where("forum_id", "==", forum_id).stream():
        ad = a.to_dict()
        ad["id"] = a.id
        answers.append(ad)
    answers.sort(key=lambda x: int(x.get("question_num", 0)))
    forum["answers"] = answers
    students = []
    for s in db().collection("students").where("forum_id", "==", forum_id).stream():
        sd = s.to_dict()
        sd["id"] = s.id
        students.append(sd)
    forum["students"] = students
    graded = [s for s in students if s.get("status") == "graded"]
    totals = [s.get("total", 0) for s in graded]
    forum["student_count"] = len(students)
    forum["graded_count"] = len(graded)
    forum["avg_score"] = round(sum(totals) / len(totals), 1) if totals else 0
    forum["avg_pct"] = round((forum["avg_score"] / max(forum.get("total_marks", 100), 1)) * 100, 1) if totals else 0
    return {"success": True, "data": forum}
@router.delete("/{forum_id}")
def delete_forum(forum_id: str, p=Depends(verify_token)):
    doc = db().collection("forums").document(forum_id).get()
    if not doc.exists:
        raise HTTPException(404, "Forum not found")
    if doc.to_dict().get("teacher_id") != p["uid"]:
        raise HTTPException(403, "Not your forum")
    for a in db().collection("model_answers").where("forum_id", "==", forum_id).stream():
        a.reference.delete()
    for s in db().collection("students").where("forum_id", "==", forum_id).stream():
        s.reference.delete()
    db().collection("forums").document(forum_id).delete()
    return {"success": True, "data": {"deleted": True}}
@router.put("/{forum_id}/close")
def close_forum(forum_id: str, p=Depends(verify_token)):
    doc = db().collection("forums").document(forum_id).get()
    if not doc.exists:
        raise HTTPException(404, "Forum not found")
    db().collection("forums").document(forum_id).update({"status": "closed"})
    return {"success": True, "data": {"status": "closed"}}
@router.post("/{forum_id}/answers")
def save_answers(forum_id: str, answers: List[ModelAnswerItem], p=Depends(verify_token)):
    for a in db().collection("model_answers").where("forum_id", "==", forum_id).stream():
        a.reference.delete()
    for a in answers:
        ans_id = str(uuid.uuid4())
        db().collection("model_answers").document(ans_id).set({
            "forum_id": forum_id,
            "question_num": a.question_num,
            "question_text": a.question_text,
            "answer_text": a.answer_text,
            "keywords": a.keywords,
            "marks": a.marks,
            "note": a.note
        })
    return {"success": True, "data": {"saved": len(answers)}}
@router.get("/{forum_id}/students")
def list_students(forum_id: str, p=Depends(verify_token)):
    students = []
    for s in db().collection("students").where("forum_id", "==", forum_id).stream():
        sd = s.to_dict()
        sd["id"] = s.id
        students.append(sd)
    return {"success": True, "data": students}