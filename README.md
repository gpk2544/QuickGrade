> AI-Powered Answer Grading — RAG + LLM + Multi-Engine OCR
---
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
cd ../frontend
python -m http.server 5500
```
> **Windows tip:** Never use bare `pip` or `uvicorn` commands — if the project folder was ever moved or renamed, the launcher `.exe` files will have stale hardcoded paths and fail with *"Unable to create process"*. Always prefix with `python -m`.
---
| Service | URL |
|---------|-----|
| **Backend API** | `http://localhost:8000` |
| **API Docs** | `http://localhost:8000/docs` |
| **Frontend** | `http://localhost:5500` |
---
Create/edit `backend/.env`:
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
---
- **File Upload**: Upload PDF/image → OCR → AI extracts questions with model answers
- **Direct Text**: Paste question paper text directly → bypass OCR
- **File Upload**: Upload answer sheets → OCR → AI grades against model answers
- **Direct Text**: Paste answers directly → bypass OCR
- **RAG Support**: Upload textbook for context-aware, reference-based grading
| Mode | Use Case | How |
|------|----------|-----|
| **Upload File** | Handwritten/printed sheets | Upload PDF/image → OCR extracts text |
| **Paste Text** | Digital text only | Paste text directly → No OCR needed |
- Groq LLM (`llama-3.1-8b-instant`, 128K context window)
- Quality pre-check (detects blank/garbled answers)
- Semantic similarity via `all-MiniLM-L6-v2` embeddings + ChromaDB
- Detailed feedback with key points
- Email/Password and Google Sign-In
- Firestore for forum and student data
- Firebase Storage for uploaded files
---
```
QuickGrade/
├── frontend/                    
│   ├── index.html             
│   ├── css/main.css           
│   ├── js/
│   │   ├── app.js            
│   │   ├── api.js            
│   │   ├── backend.js        
│   │   └── animation.js      
│   └── firebase/
│       └── firebase-config.js 
│
└── backend/                   
    ├── main.py               
    ├── requirements.txt      
    ├── .env                  
    ├── serviceAccountKey.json 
    │
    ├── routes/               
    │   ├── auth.py           
    │   ├── forums.py         
    │   ├── upload.py         
    │   ├── evaluate.py       
    │   ├── extract.py        
    │   └── export.py         
    │
    ├── services/             
    │   ├── ocr_service.py    
    │   └── pdf_parser.py     
    │
    ├── grading/              
    │   ├── grader.py         
    │   ├── llm_client.py     
    │   ├── prompt_builder.py 
    │   ├── response_parser.py
    │   └── quality_checker.py
    │
    ├── knowledge/            
    │   ├── pdf_loader.py    
    │   ├── chunker.py       
    │   ├── embedder.py      
    │   ├── vector_store.py  
    │   └── knowledge_base.py
    │
    ├── config/              
    │   └── settings.py     
    │
    └── utils/              
        ├── logger.py       
        ├── retry.py        
        └── text.py         
```
---
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
| `/upload/answer-sheet` | POST | Upload student answer (file OR text) - 20s delay |
| `/upload/textbook` | POST | Upload textbook for RAG |
| `/evaluate/student` | POST | Grade single student |
| `/evaluate/all` | POST | Grade all students in a forum |
| `/forums/{id}/export/excel` | GET | Export results as Excel |
---
```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
MIT License 2026