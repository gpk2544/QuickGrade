# QuickGrade
> AI-Powered Answer Grading — RAG + LLM + Multi-Engine OCR

---

## Quick Start

```bash
# 1. Navigate to backend
cd backend

# 2. Create virtual environment
python -m venv .venv

# 3. Activate virtual environment
# Windows:
.venv\Scripts\activate
# Mac/Linux:
source .venv/bin/activate

# 4. Install dependencies
# ⚠️ Always use "python -m pip" — never bare "pip" (launcher paths may be stale)
python -m pip install -r requirements.txt

# 5. Configure environment
# Copy .env.example → .env and fill in your credentials

# 6. Run backend
# ⚠️ Always use "python -m uvicorn" — never bare "uvicorn"
python -m uvicorn main:app --reload --port 8000

# 7. Run frontend (new terminal)
cd ../frontend
python -m http.server 5500
```

> **Windows tip:** Never use bare `pip` or `uvicorn` commands — if the project folder was ever moved or renamed, the launcher `.exe` files will have stale hardcoded paths and fail with *"Unable to create process"*. Always prefix with `python -m`.

---

## Access URLs

| Service | URL |
|---------|-----|
| **Backend API** | `http://localhost:8000` |
| **API Docs** | `http://localhost:8000/docs` |
| **Frontend** | `http://localhost:5500` |

---

## Environment Variables (.env)

Create/edit `backend/.env`:

```env
# GROQ API (FREE - https://console.groq.com)
GROQ_API_KEY=your_groq_api_key_here
# Use llama-3.1-8b-instant (128K context) — NOT llama3-8b-8192 (only 8K)
GROQ_MODEL=llama-3.1-8b-instant

# Firebase (Download from Firebase Console → Project Settings → Service Accounts)
FIREBASE_CREDENTIALS=serviceAccountKey.json
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_PROJECT_ID=your-project-id
# ⚠️ serviceAccountKey.json must belong to the SAME Firebase project as the frontend

# OCR Engine
# google = uses Google Cloud Vision (best for handwriting)
OCR_ENGINE=google
GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json

# ChromaDB (RAG)
CHROMA_DIR=./chroma_db
EMBED_MODEL=all-MiniLM-L6-v2

# Frontend URL (CORS)
FRONTEND_URL=http://localhost:5500
```

---

## Features

### 1. Question Paper Extraction
- **File Upload**: Upload PDF/image → OCR → AI extracts questions with model answers
- **Direct Text**: Paste question paper text directly → bypass OCR

### 2. Student Answer Grading
- **File Upload**: Upload answer sheets → OCR → AI grades against model answers
- **Direct Text**: Paste answers directly → bypass OCR
- **RAG Support**: Upload textbook for context-aware, reference-based grading

### 3. Two Input Modes

| Mode | Use Case | How |
|------|----------|-----|
| **Upload File** | Handwritten/printed sheets | Upload PDF/image → OCR extracts text |
| **Paste Text** | Digital text only | Paste text directly → No OCR needed |

### 4. AI Grading Pipeline
- Groq LLM (`llama-3.1-8b-instant`, 128K context window)
- Quality pre-check (detects blank/garbled answers)
- Semantic similarity via `all-MiniLM-L6-v2` embeddings + ChromaDB
- Detailed feedback with key points

### 5. Firebase Auth & Storage
- Email/Password and Google Sign-In
- Firestore for forum and student data
- Firebase Storage for uploaded files

---

## Project Structure

```
QuickGrade/
├── frontend/                    # Frontend (HTML/CSS/JS)
│   ├── index.html             # Main UI
│   ├── css/main.css           # Styles
│   ├── js/
│   │   ├── app.js            # App logic (uses window.userForums)
│   │   ├── api.js            # API client
│   │   ├── backend.js        # Firebase Auth + Backend integration
│   │   └── animation.js      # Animations
│   └── firebase/
│       └── firebase-config.js # Firebase SDK config
│
└── backend/                   # FastAPI backend
    ├── main.py               # Entry point + CORS
    ├── requirements.txt      # Dependencies
    ├── .env                  # Environment variables (not committed)
    ├── serviceAccountKey.json # Firebase Admin credentials (not committed)
    │
    ├── routes/               # API endpoints
    │   ├── auth.py           # Firebase token verification
    │   ├── forums.py         # Forum CRUD (Firestore)
    │   ├── upload.py         # File/text answer upload
    │   ├── evaluate.py       # AI grading
    │   ├── extract.py        # Question extraction (Groq LLM)
    │   └── export.py         # Excel export
    │
    ├── services/             # External services
    │   ├── ocr_service.py    # Google Vision + EasyOCR fallback
    │   └── pdf_parser.py     # PyMuPDF text extraction
    │
    ├── grading/              # AI grading module
    │   ├── grader.py         # Main grading facade
    │   ├── llm_client.py     # Groq API client
    │   ├── prompt_builder.py # Prompt construction
    │   ├── response_parser.py# JSON parsing
    │   └── quality_checker.py# Answer validation
    │
    ├── knowledge/            # RAG knowledge base
    │   ├── pdf_loader.py    # PDF text extraction
    │   ├── chunker.py       # Text chunking
    │   ├── embedder.py      # Sentence embeddings
    │   ├── vector_store.py  # ChromaDB
    │   └── knowledge_base.py# Facade
    │
    ├── config/              # Configuration
    │   └── settings.py     # All settings
    │
    └── utils/              # Utilities
        ├── logger.py       # Logging
        ├── retry.py        # Retry decorator
        └── text.py         # Text utilities
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/register` | POST | Register new user |
| `/auth/verify` | POST | Verify Firebase token |
| `/auth/me` | GET | Get current user |
| `/forums` | GET | List all forums (sorted by date) |
| `/forums` | POST | Create new forum |
| `/forums/{id}` | GET | Get forum details + students |
| `/forums/{id}/close` | PUT | Close a forum |
| `/forums/{id}/answers` | POST | Save model answers |
| `/extract/questions` | POST | Extract questions (file OR text) |
| `/upload/answer-sheet` | POST | Upload student answer (file OR text) |
| `/upload/textbook` | POST | Upload textbook for RAG |
| `/evaluate/student` | POST | Grade single student |
| `/evaluate/all` | POST | Grade all students in a forum |
| `/forums/{id}/export/excel` | GET | Export results as Excel |

---

## Troubleshooting

### `Unable to create process using pip.exe` / `uvicorn.exe`
The `.exe` launchers have stale hardcoded paths (happens when the project folder is moved/renamed).
**Fix:** Always use `python -m pip` and `python -m uvicorn` instead of bare commands.

```bash
# ❌ Don't use:
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# ✅ Use instead:
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

### Token verification failed: incorrect "aud" claim
Your `serviceAccountKey.json` belongs to a **different Firebase project** than your frontend.
**Fix:** Go to Firebase Console → the correct project → Project Settings → Service Accounts → Generate new private key → replace `serviceAccountKey.json`.

### Groq 400 Bad Request on large PDFs
The old model `llama3-8b-8192` only has an 8K token context window — large question papers overflow it.
**Fix:** Set `GROQ_MODEL=llama-3.1-8b-instant` in `.env` (128K context, same free tier).

### Forums show count but table is empty
Caused by a variable scope mismatch between `app.js` (local `userForums`) and `backend.js` (`window.userForums`).
**Fix:** Already resolved — `app.js` now uses `window.userForums` globally.

### OCR Not Working
1. Check `GOOGLE_APPLICATION_CREDENTIALS` points to a valid `serviceAccountKey.json`
2. Enable **Cloud Vision API** in Google Cloud Console for your project
3. Check terminal logs for `PermissionDenied` or `UNAUTHENTICATED` errors

### Frontend Not Connecting to Backend
1. Ensure backend runs on port 8000 (`python -m uvicorn main:app --reload --port 8000`)
2. Check `FRONTEND_URL=http://localhost:5500` in `.env` (CORS)
3. Hard refresh: `Ctrl + Shift + R`

### Grading Not Working
1. Verify `GROQ_API_KEY` is set in `.env`
2. Check the key is valid at https://console.groq.com
3. Check terminal logs for LLM errors

---

## License

MIT License — Jeppiaar Engineering College AI&DS 2025
