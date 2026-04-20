"""
Extract Route — AI question extraction from uploaded papers or direct text
POST /extract/questions — extract questions using Groq LLM
Supports: file upload OR direct text paste (bypass OCR)
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from routes.auth import verify_token
from services.pdf_parser import pdf_bytes_to_text
from services.ocr_service import extract_text_from_bytes
from utils.logger import get_logger
import os, json, re

log = get_logger(__name__)

router = APIRouter()

# Models ordered by preference: large context first, small as fallback
GROQ_MODELS = [
    "llama-3.1-8b-instant",   # 128K context — primary
    "llama3-8b-8192",          # 8K context  — fallback (small papers only)
]


def _call_groq(prompt: str) -> str:
    """Call Groq API with automatic model fallback."""
    from groq import Groq

    key = os.getenv("GROQ_API_KEY", "")
    if not key:
        raise HTTPException(500, "GROQ_API_KEY not set")

    client = Groq(api_key=key)

    # Use env override if set, otherwise try models in order
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
            # Only retry on token/context errors, not auth errors
            if "401" in err_str or "403" in err_str or "api_key" in err_str.lower():
                raise HTTPException(500, f"Groq auth error: {err_str}")
            continue

    raise HTTPException(500, f"All Groq models failed. Last error: {last_err}")


def _smart_truncate(text: str, max_chars: int = 8000) -> str:
    """
    Smart truncation: for large texts, keep the beginning (which usually
    has the most questions in a question paper) and add a note for the AI.
    """
    if len(text) <= max_chars:
        return text

    # Try to cut at a clean newline boundary
    truncated = text[:max_chars]
    last_newline = truncated.rfind("\n")
    if last_newline > max_chars * 0.8:
        truncated = truncated[:last_newline]

    log.info(f"Text truncated from {len(text)} to {len(truncated)} chars")
    return truncated + "\n\n[... document truncated for processing ...]"


def _build_prompt(input_text: str, subject: str, total_marks: int) -> str:
    truncated = _smart_truncate(input_text, max_chars=8000)
    return f"""Extract ALL exam questions from this question paper text.

Subject: {subject} | Total marks: {total_marks}

For each question provide:
- question: the exact question text
- answer: a complete model answer (2-5 sentences for theory, full steps for numericals)
- keywords: 3-5 key terms the student must mention (comma-separated)
- marks: marks allocated (look for numbers near the question, or distribute {total_marks} evenly)
- comment: a brief grading hint

QUESTION PAPER:
{truncated}

Return ONLY a valid JSON array. No markdown. No extra text:
[
  {{
    "question": "...",
    "answer": "...",
    "keywords": "...",
    "marks": 10,
    "comment": "..."
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
    """Extract questions from question paper — file OR direct text.

    Priority:
      1. If 'text' param provided (direct paste) → use directly, skip OCR
      2. If 'file' provided → extract text via PDF parser or OCR
    """
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

        # Strip markdown code fences if present
        clean = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
        clean = re.sub(r"```\s*$", "", clean, flags=re.MULTILINE).strip()

        questions = json.loads(clean)
        if not isinstance(questions, list):
            raise ValueError("Response is not a JSON array")

        log.info(f"Extracted {len(questions)} questions successfully")
        return {"success": True, "data": questions}

    except json.JSONDecodeError as jde:
        log.error(f"JSON parse error: {jde}. Raw response: {raw[:500]}")
        # Try to rescue a partial array from the response
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
