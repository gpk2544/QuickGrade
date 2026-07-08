from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from routes.auth import verify_token
from services.pdf_parser import pdf_bytes_to_text
from services.ocr_service import extract_text_from_bytes
from utils.logger import get_logger
import os, json, re
log = get_logger(__name__)
router = APIRouter()
GROQ_MODELS = [
    "llama-3.1-8b-instant",   
    "llama3-8b-8192",          
]
def _call_groq(prompt: str) -> str:
    from groq import Groq
    key = os.getenv("GROQ_API_KEY", "")
    if not key:
        raise HTTPException(500, "GROQ_API_KEY not set")
    client = Groq(api_key=key)
    env_model = os.getenv("GROQ_MODEL", "")
    models_to_try = [env_model] if env_model else GROQ_MODELS
    last_err = None
    for model in models_to_try:
        try:
            log.info(f"Trying Groq model: {model}")
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an expert teacher assistant. "
                            "You analyze question papers and extract questions with model answers. "
                            "Always respond with valid JSON only — no markdown, no preamble, no explanation."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                max_tokens=2000,
                temperature=0.15,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            err_str = str(e)
            log.warning(f"Model {model} failed: {err_str}")
            last_err = e
            if "401" in err_str or "403" in err_str or "api_key" in err_str.lower():
                raise HTTPException(500, f"Groq auth error: {err_str}")
            continue
    raise HTTPException(500, f"All Groq models failed. Last error: {last_err}")
def _smart_truncate(text: str, max_chars: int = 8000) -> str:
    if len(text) <= max_chars:
        return text
    truncated = text[:max_chars]
    last_newline = truncated.rfind("\n")
    if last_newline > max_chars * 0.8:
        truncated = truncated[:last_newline]
    log.info(f"Text truncated from {len(text)} to {len(truncated)} chars")
    return truncated + "\n\n[... document truncated for processing ...]"
def _build_prompt(input_text: str, subject: str, total_marks: int) -> str:
    truncated = _smart_truncate(input_text, max_chars=8000)
    return f"""You are a professional examiner assistant. Extract questions from the following text and format them as a structured JSON array.

Subject: {subject}
Total marks to allocate: {total_marks}

INPUT TEXT:
---
{truncated}
---

INSTRUCTIONS:
1. Identify all distinct questions from the text.
2. For each question, provide:
   - "question_num": The index of the question.
   - "question": The full text of the question.
   - "answer": A comprehensive model answer.
   - "marks": A reasonable mark allocation (total sum should roughly equal {total_marks}).
   - "keywords": A string of key terms separated by commas.
   - "comment": A brief grading tip or internal note.
3. Return ONLY a valid JSON array of objects. Do NOT include markdown code blocks (```json) or any other text.

Example format:
[
  {{
    "question_num": 1,
    "question": "Example?",
    "answer": "Example answer.",
    "marks": 5,
    "keywords": "example, test",
    "comment": "Easy question"
  }}
]"""
@router.post("/questions")
async def extract_questions(
    file: UploadFile = File(None),
    text: str = Form(""),
    subject: str = Form("General"),
    total_marks: int = Form(100),
    p=Depends(verify_token),
):
    input_text = ""
    if text and len(text.strip()) >= 20:
        log.info(f"Using direct text input: {len(text)} chars")
        input_text = text.strip()
    elif file:
        data = await file.read()
        if len(data) > 20 * 1024 * 1024:
            raise HTTPException(400, "File too large — max 20MB")
        ext = (file.filename or "").split(".")[-1].lower()
        log.info(f"Extracting from file: {file.filename} ({ext}), size: {len(data)} bytes")
        if ext == "pdf":
            input_text = pdf_bytes_to_text(data)
        else:
            input_text = await extract_text_from_bytes(data)
        char_count = len(input_text) if input_text else 0
        log.info(f"Text extracted: {char_count} chars")
        if input_text:
            log.info(f"Preview: {input_text[:300]}")
    else:
        raise HTTPException(400, "Provide either 'text' or 'file'")
    if not input_text or len(input_text.strip()) < 20:
        raise HTTPException(
            422,
            "Could not extract readable text from the file. "
            "Try a text-based PDF or paste the questions directly."
        )
    prompt = _build_prompt(input_text, subject, total_marks)
    log.info(f"Prompt length: {len(prompt)} chars, sending to Groq...")
    try:
        raw = _call_groq(prompt)
        log.info(f"Groq response length: {len(raw)} chars")
        log.debug(f"Groq raw response: {raw[:500]}")
        clean = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
        clean = re.sub(r"```\s*$", "", clean, flags=re.MULTILINE).strip()
        questions = json.loads(clean)
        if not isinstance(questions, list):
            raise ValueError("Response is not a JSON array")
        log.info(f"Extracted {len(questions)} questions successfully")
        return {"success": True, "data": questions}
    except json.JSONDecodeError as jde:
        log.error(f"JSON parse error: {jde}. Raw response: {raw[:500]}")
        match = re.search(r"\[.*?\]", raw, re.DOTALL)
        if match:
            try:
                questions = json.loads(match.group())
                log.info(f"Rescued {len(questions)} questions from partial JSON")
                return {"success": True, "data": questions}
            except Exception:
                pass
        raise HTTPException(500, "AI returned invalid JSON. Try a different file or paste the text directly.")
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Extraction failed: {type(e).__name__}: {e}")
        raise HTTPException(500, f"AI extraction failed: {str(e)}")