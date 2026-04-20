"""
QuickGrade Backend — FastAPI + Firebase
Run: uvicorn main:app --reload --port 8000
Docs: http://localhost:8000/docs
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials
import os, logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

# ── Firebase Init ──
cred_path = os.getenv("FIREBASE_CREDENTIALS", "serviceAccountKey.json")
if not firebase_admin._apps:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred, {
        "storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET", "")
    })

app = FastAPI(title="QuickGrade API", version="1.0.0")

# ── CORS ──
_default_origins = [
    "http://localhost:5500", "http://127.0.0.1:5500",
    "http://localhost:5501", "http://127.0.0.1:5501",
    "http://localhost:3000", "http://127.0.0.1:3000",
    "http://localhost:5173",
]
_extra = os.getenv("CORS_ORIGINS", "")
if _extra:
    _default_origins.extend([u.strip() for u in _extra.split(",") if u.strip()])
_frontend_url = os.getenv("FRONTEND_URL", "")
if _frontend_url and _frontend_url not in _default_origins:
    _default_origins.append(_frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_default_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global exception handler — consistent response format ──
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    status = getattr(exc, "status_code", 500)
    detail = getattr(exc, "detail", str(exc))
    logger.error(f"❌ {request.method} {request.url.path} → {status}: {detail}")
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=status,
        content={"success": False, "message": detail}
    )

# ── Routes ──
from routes.auth     import router as auth_router
from routes.forums   import router as forums_router
from routes.evaluate import router as evaluate_router
from routes.upload   import router as upload_router
from routes.export   import router as export_router
from routes.extract  import router as extract_router

app.include_router(auth_router,     prefix="/auth",     tags=["Auth"])
app.include_router(forums_router,   prefix="/forums",   tags=["Forums"])
app.include_router(evaluate_router, prefix="/evaluate", tags=["Evaluate"])
app.include_router(upload_router,   prefix="/upload",   tags=["Upload"])
app.include_router(export_router,   prefix="/forums",   tags=["Export"])
app.include_router(extract_router,  prefix="/extract",  tags=["Extract"])

@app.get("/")
def root():
    return {"success": True, "data": {"status": "QuickGrade API running ✅"}}

@app.get("/health")
def health():
    return {"success": True, "data": {"status": "ok"}}
