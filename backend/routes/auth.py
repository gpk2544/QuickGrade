"""
Auth Routes — Firebase Auth + Firestore user profiles
POST /auth/register  — create user in Firebase Auth + Firestore profile
POST /auth/verify    — verify Firebase ID token (frontend login)
GET  /auth/me        — get current user profile
PUT  /auth/profile   — update user profile
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from firebase_admin import auth as fb_auth, firestore, storage
from typing import Optional
import datetime, os

router   = APIRouter()
security = HTTPBearer()

def db():
    return firestore.client()

# ── Token verification ──
def verify_token(creds: HTTPAuthorizationCredentials = Depends(security)):
    try:
        decoded = fb_auth.verify_id_token(creds.credentials, clock_skew_seconds=60)
        return decoded
    except Exception:
        raise HTTPException(401, "Invalid or expired token")

# ── Models ──
class RegisterReq(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str
    school: str = ""

class VerifyReq(BaseModel):
    id_token: str

class ProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    school: Optional[str] = None
    phone: Optional[str] = None
    dob: Optional[str] = None
    subjects: Optional[str] = None
    classes: Optional[str] = None
    emp_id: Optional[str] = None
    role: Optional[str] = None

# ── Register ──
@router.post("/register")
def register(req: RegisterReq):
    try:
        # Create Firebase Auth user
        user = fb_auth.create_user(
            email=req.email,
            password=req.password,
            display_name=f"{req.first_name} {req.last_name}"
        )
        # Create Firestore profile doc
        profile = {
            "uid": user.uid,
            "first_name": req.first_name,
            "last_name": req.last_name,
            "email": req.email,
            "school": req.school,
            "role": "teacher",
            "avatar_url": "",
            "phone": "",
            "dob": "",
            "subjects": "",
            "classes": "",
            "emp_id": "",
            "created_at": datetime.datetime.utcnow().isoformat()
        }
        db().collection("users").document(user.uid).set(profile)

        # Create custom token for immediate login
        custom_token = fb_auth.create_custom_token(user.uid).decode("utf-8")
        return {"success": True, "data": {"token": custom_token, "user": profile}}
    except Exception as e:
        raise HTTPException(400, str(e))

# ── Verify (login) — frontend sends Firebase ID token ──
@router.post("/verify")
def verify(req: VerifyReq):
    try:
        decoded = fb_auth.verify_id_token(req.id_token, clock_skew_seconds=60)
        uid = decoded["uid"]
        # Get or create profile
        doc = db().collection("users").document(uid).get()
        if doc.exists:
            profile = doc.to_dict()
        else:
            # Auto-create profile from Firebase Auth user
            fb_user = fb_auth.get_user(uid)
            name_parts = (fb_user.display_name or "User").split(" ", 1)
            profile = {
                "uid": uid,
                "first_name": name_parts[0],
                "last_name": name_parts[1] if len(name_parts) > 1 else "",
                "email": fb_user.email or "",
                "school": "",
                "role": "teacher",
                "avatar_url": fb_user.photo_url or "",
                "created_at": datetime.datetime.utcnow().isoformat()
            }
            db().collection("users").document(uid).set(profile)
        return {"success": True, "data": {"user": profile}}
    except Exception as e:
        raise HTTPException(401, f"Token verification failed: {e}")

# ── Get current user ──
@router.get("/me")
def me(p=Depends(verify_token)):
    doc = db().collection("users").document(p["uid"]).get()
    if not doc.exists:
        raise HTTPException(404, "User profile not found")
    return {"success": True, "data": doc.to_dict()}

# ── Update profile ──
@router.put("/profile")
def update_profile(req: ProfileUpdate, p=Depends(verify_token)):
    update = {k: v for k, v in req.dict().items() if v is not None}
    if not update:
        raise HTTPException(400, "No fields to update")
    db().collection("users").document(p["uid"]).update(update)
    doc = db().collection("users").document(p["uid"]).get()
    return {"success": True, "data": doc.to_dict()}

# ── Upload avatar ──
@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    p=Depends(verify_token)
):
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(400, "Max 5MB for avatar")

    bucket = storage.bucket()
    blob = bucket.blob(f"avatars/{p['uid']}/{file.filename}")
    blob.upload_from_string(data, content_type=file.content_type)
    blob.make_public()
    url = blob.public_url

    db().collection("users").document(p["uid"]).update({"avatar_url": url})
    return {"success": True, "data": {"avatar_url": url}}
