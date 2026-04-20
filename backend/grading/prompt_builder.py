"""
grading/prompt_builder.py
==========================
Responsibility: construct the grading prompt sent to the LLM.

Isolated here so prompt wording can be tuned without touching
API/retry/parse logic in neighbouring modules.
"""

from __future__ import annotations

from config.settings import GRADING
from utils.text import trim_to_budget


# ─── System message (stable across all calls) ─────────────────────────────────
SYSTEM_MESSAGE = (
    "You are a precise, fair academic grader. "
    "Respond ONLY with a valid JSON object. "
    "No markdown, no explanation, no preamble."
)


def build_prompt(
    question:          str,
    student_answer:    str,
    reference_context: str,
    max_marks:         int,
    quality_label:     str = "ok",
) -> str:
    """
    Build the full user-turn grading prompt.

    Trims context and answer to token budgets defined in config.
    Injects an OCR-leniency warning when quality_label indicates garbled text.

    Args:
        question:          The exam question text.
        student_answer:    OCR-extracted (or typed) student answer.
        reference_context: RAG-retrieved textbook context.
        max_marks:         Maximum marks for this question.
        quality_label:     Output of quality_checker.check() — 'ok'|'garbled'|etc.

    Returns:
        Prompt string ready to pass to the LLM as the user message.
    """
    context_body = trim_to_budget(reference_context, GRADING.max_context_chars)
    answer_body  = trim_to_budget(student_answer,    GRADING.max_answer_chars)

    ocr_warning = ""
    if quality_label in ("garbled", "too_short"):
        ocr_warning = (
            "\n⚠️  OCR QUALITY WARNING: The student answer may contain OCR artefacts "
            "(garbled characters, repeated words, missing spaces). "
            "Be extra lenient — reward any recognisable concepts.\n"
        )

    return f"""You are an expert academic evaluator grading a student exam answer.

───────────────────── QUESTION ─────────────────────
{question}
Maximum marks: {max_marks}
─────────────────── REFERENCE KNOWLEDGE ────────────
{context_body}
──────────────────── STUDENT ANSWER ────────────────
{answer_body}{ocr_warning}
────────────────────────────────────────────────────

GRADING RULES:
1. Identify EXPECTED KEY POINTS a complete answer must contain.
2. Compare student answer against each key point; classify as:
   covered / partially_covered / missing.
3. Award marks at 0.5-mark resolution; then round to nearest integer.
4. HARD CAP: marks_awarded ≤ {max_marks}.  Zero is valid.
5. Overlook OCR spelling errors; reward demonstrated understanding.
6. Report your certainty as grading_confidence (0.0–1.0).

OUTPUT ONLY this JSON — no markdown, no preamble, no trailing text:
{{
  "max_marks": {max_marks},
  "marks_awarded": <integer 0–{max_marks}>,
  "grading_confidence": <float 0.0–1.0>,
  "key_points": ["<point 1>", "<point 2>"],
  "points_covered": ["<covered point>"],
  "points_partially_covered": ["<partial point>"],
  "points_missing": ["<missing point>"],
  "marks_breakdown": "<one sentence, e.g. '3/3 for concept X, 2/5 for Y'>",
  "evaluation": "<2–3 sentence objective assessment>",
  "feedback": "<2–3 sentence constructive feedback for the student>"
}}"""
