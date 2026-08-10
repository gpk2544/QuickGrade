# 🎓 QuickGrade

### AI-Powered Answer Grading using RAG, LLM & OCR

QuickGrade is a full-stack AI-based answer evaluation system that automates the process of evaluating student answer sheets. It uses **OCR, LLMs, semantic similarity, and RAG** to compare student answers with model answers and reference material, then generates scores and detailed feedback.

---

# 📂 Project Structure

```text
QuickGrade/
│
├── frontend/
│   ├── index.html
│   ├── css/
│   │   └── main.css
│   ├── js/
│   │   ├── app.js
│   │   ├── api.js
│   │   ├── backend.js
│   │   └── animation.js
│   └── firebase/
│       └── firebase-config.js
│
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── .env
│   ├── serviceAccountKey.json
│   │
│   ├── routes/
│   │   ├── auth.py
│   │   ├── forums.py
│   │   ├── upload.py
│   │   ├── evaluate.py
│   │   ├── extract.py
│   │   └── export.py
│   │
│   ├── services/
│   │   ├── ocr_service.py
│   │   └── pdf_parser.py
│   │
│   ├── grading/
│   │   ├── grader.py
│   │   ├── llm_client.py
│   │   ├── prompt_builder.py
│   │   ├── response_parser.py
│   │   └── quality_checker.py
│   │
│   ├── knowledge/
│   │   ├── pdf_loader.py
│   │   ├── chunker.py
│   │   ├── embedder.py
│   │   ├── vector_store.py
│   │   └── knowledge_base.py
│   │
│   ├── config/
│   │   └── settings.py
│   │
│   └── utils/
│       ├── logger.py
│       ├── retry.py
│       └── text.py
│
├── database/
├── .github/
│   └── workflows/
├── .gitignore
├── requirements.txt
└── README.md
```

---

# 🚀 How to Run

## 1. Clone the repository

```bash
git clone https://github.com/gpk2544/QuickGrade.git
cd QuickGrade
```

## 2. Set up the backend

```bash
cd backend
python -m venv .venv
```

### Windows

```bash
.venv\Scripts\activate
```

### Linux / macOS

```bash
source .venv/bin/activate
```

Install dependencies:

```bash
python -m pip install -r requirements.txt
```

## 3. Configure `.env`

Create `backend/.env`:

```env
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.1-8b-instant

FIREBASE_CREDENTIALS=serviceAccountKey.json
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_PROJECT_ID=your-project-id

OCR_ENGINE=google
GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json

CHROMA_DIR=./chroma_db
EMBED_MODEL=all-MiniLM-L6-v2

FRONTEND_URL=http://localhost:5500
```

Add your Firebase `serviceAccountKey.json` to the backend directory.

**Do not commit `.env` or `serviceAccountKey.json` to GitHub.**

## 4. Start the backend

From the `backend` directory:

```bash
python -m uvicorn main:app --reload --port 8000
```

Backend:

`http://localhost:8000`

API documentation:

`http://localhost:8000/docs`

## 5. Start the frontend

Open another terminal:

```bash
cd frontend
python -m http.server 5500
```

Frontend:

`http://localhost:5500`

---

# 🧠 How QuickGrade Works

```text
Question Paper
      ↓
 OCR / Direct Text
      ↓
Question Extraction
      ↓
Model Answers
      ↓
Student Answer Sheet
      ↓
 OCR / Direct Text
      ↓
Quality Check
      ↓
Semantic Similarity + RAG
      ↓
LLM Evaluation
      ↓
Score + Feedback
      ↓
Excel Export
```

### Question Paper

Teachers can upload a PDF/image or directly paste the question paper text.

### Answer Sheets

Student answers can be uploaded as PDF/images or entered directly as text.

### OCR

Uploaded documents are processed using OCR to extract the text.

### Quality Check

The system checks for blank, corrupted, or unusable answers before grading.

### RAG

A textbook or reference PDF can be uploaded. The document is split into chunks, converted into embeddings using `all-MiniLM-L6-v2`, and stored in **ChromaDB**.

Relevant content is retrieved and provided to the LLM during evaluation.

### LLM Grading

QuickGrade uses **Groq's Llama 3.1 8B Instant** to evaluate the student's answer against the model answer and retrieved context.

The system generates:

* Score
* Key points
* Detailed feedback

### Excel Export

Evaluation results can be exported as an Excel file.

---

# ✨ Features

* 📄 PDF/Image question paper processing
* ✍️ Student answer-sheet OCR
* 📝 Direct text input
* 🤖 LLM-based answer evaluation
* 📚 RAG-based reference material
* 🔍 Semantic similarity
* 🧠 ChromaDB vector storage
* 🛡️ Answer quality checking
* 👤 Email/Password authentication
* 🔐 Google Sign-In
* 👥 Forum and student management
* 📊 Multiple-student evaluation
* 📥 Excel result export

---

# 🛠️ Tech Stack

| Category        | Technologies               |
| --------------- | -------------------------- |
| Frontend        | HTML, CSS, JavaScript      |
| Backend         | Python, FastAPI            |
| AI              | Groq, Llama 3.1 8B Instant |
| Embeddings      | all-MiniLM-L6-v2           |
| Vector Database | ChromaDB                   |
| OCR             | Google OCR                 |
| Authentication  | Firebase Authentication    |
| Database        | Firestore                  |
| Storage         | Firebase Storage           |
| Export          | Excel                      |

---

# 🔌 API Endpoints

| Endpoint                    | Method | Description            |
| --------------------------- | ------ | ---------------------- |
| `/auth/register`            | POST   | Register user          |
| `/auth/verify`              | POST   | Verify Firebase token  |
| `/auth/me`                  | GET    | Get current user       |
| `/forums`                   | GET    | List forums            |
| `/forums`                   | POST   | Create forum           |
| `/forums/{id}`              | GET    | Get forum details      |
| `/forums/{id}/close`        | PUT    | Close forum            |
| `/forums/{id}/answers`      | POST   | Save model answers     |
| `/extract/questions`        | POST   | Extract questions      |
| `/upload/answer-sheet`      | POST   | Upload student answers |
| `/upload/textbook`          | POST   | Upload textbook        |
| `/evaluate/student`         | POST   | Evaluate one student   |
| `/evaluate/all`             | POST   | Evaluate all students  |
| `/forums/{id}/export/excel` | GET    | Export results         |

---

# 🎯 Project Objective

QuickGrade aims to reduce the time and manual effort required for descriptive answer evaluation while providing students with more detailed and consistent feedback.

The project combines **AI, NLP, OCR, RAG, vector search, and full-stack web development** into a single educational platform.

---

# 🌐 Live Application

**QuickGrade:** https://quick-grade-gilt.vercel.app/

**GitHub:** https://github.com/gpk2544/QuickGrade

---

# 👨‍💻 Project Information

**Project:** QuickGrade
**Type:** Final Year Project
**Domain:** AI / EdTech
**Architecture:** Full-Stack AI Application
**License:** MIT
