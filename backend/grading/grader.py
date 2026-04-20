"""
grading/grader.py
==================
Public façade for the grading package.
Orchestrates: quality_checker → prompt_builder → llm_client → response_parser.

Exposes:
    grade(question, answer, context, max_marks) → result dict
    grade_batch(pairs, contexts)                → list of result dicts
    clear_cache()                               → flush eval cache
"""

from __future__ import annotations

import hashlib
from typing import Optional, List, Dict

from config.settings import GRADING
from grading.quality_checker  import check  as check_quality
from grading.prompt_builder   import build_prompt, SYSTEM_MESSAGE
from grading.llm_client       import call   as llm_call
from grading.response_parser  import parse  as parse_response
from utils.text               import extract_marks_from_text
from utils.logger             import get_logger

log = get_logger(__name__)

# Session-scoped evaluation cache: same question+answer → skip API call
_EVAL_CACHE: Dict[str, dict] = {}


def grade(
    question:          str,
    student_answer:    str,
    reference_context: str,
    max_marks:         Optional[int] = None,
) -> dict:
    """
    STEP 5 — Fully automated grading pipeline.

    1. Auto-detect max_marks from question text if not supplied.
    2. Pre-flight quality check on the answer.
    3. Cache lookup — return cached result if available.
    4. Build prompt → call LLM → parse JSON response.
    5. Cache and return validated result dict.

    Args:
        question:          Exam question text.
        student_answer:    OCR-extracted or typed student answer.
        reference_context: RAG-retrieved reference text.
        max_marks:         Override marks; auto-detected if None.

    Returns:
        Dict with keys: max_marks, marks_awarded, grading_confidence,
        key_points, points_covered, points_partially_covered,
        points_missing, marks_breakdown, evaluation, feedback,
        _parse_stage, _model (last model used).
    """
    # ── 1. Resolve max_marks ──────────────────────────────────────────────
    if max_marks is None:
        max_marks = extract_marks_from_text(question)
    max_marks = max(1, int(max_marks))

    # ── 2. Quality pre-check ──────────────────────────────────────────────
    quality_label, quality_reason = check_quality(student_answer)
    log.info("Answer quality: %s — %s", quality_label, quality_reason)

    if quality_label == "blank":
        return _zero_result(max_marks, "blank")
    if quality_label == "too_short":
        return _zero_result(max_marks, "too_short")

    # ── 3. Cache lookup ───────────────────────────────────────────────────
    cache_key = hashlib.md5(
        f"{question[:200]}{student_answer[:200]}{max_marks}".encode()
    ).hexdigest()

    if cache_key in _EVAL_CACHE:
        log.info("Evaluation cache hit.")
        return _EVAL_CACHE[cache_key]

    # ── 4. Build prompt → call LLM → parse ────────────────────────────────
    prompt = build_prompt(
        question, student_answer, reference_context, max_marks, quality_label
    )

    try:
        raw_response = llm_call(prompt, SYSTEM_MESSAGE)
        result       = parse_response(raw_response, max_marks)
        result["_model"] = GRADING.models[0]   # best-effort; llm_client may have used fallback
    except RuntimeError as exc:
        log.error("LLM call failed: %s", exc)
        return _error_result(max_marks, str(exc))

    # ── 5. Cache and return ───────────────────────────────────────────────
    _EVAL_CACHE[cache_key] = result
    log.info(
        "Grade: %d/%d (confidence=%.2f, parse_stage=%s)",
        result["marks_awarded"], max_marks,
        result["grading_confidence"], result.get("_parse_stage"),
    )
    return result


def grade_batch(
    pairs:    List[tuple],
    contexts: Dict[str, str],
) -> List[dict]:
    """
    Grade multiple (question, answer, max_marks) tuples sequentially.

    Args:
        pairs:    List of (question, student_answer, max_marks) tuples.
        contexts: Dict mapping question text → retrieved context.

    Returns:
        List of result dicts (each includes the 'question' key).
    """
    results = []
    n = len(pairs)
    for i, (question, answer, marks) in enumerate(pairs):
        log.info("Batch grading %d/%d…", i + 1, n)
        ctx    = contexts.get(question, "[No context]")
        result = grade(question, answer, ctx, marks)
        result["question"] = question
        results.append(result)

    total_awarded = sum(r.get("marks_awarded", 0) for r in results)
    total_max     = sum(r.get("max_marks",     0) for r in results)
    log.info("Batch complete: %d/%d marks.", total_awarded, total_max)
    return results


def clear_cache() -> None:
    """Flush the evaluation cache (call between different students)."""
    _EVAL_CACHE.clear()
    log.info("Evaluation cache cleared.")


# ─── Result factories ─────────────────────────────────────────────────────────

def _zero_result(max_marks: int, reason: str) -> dict:
    messages = {
        "blank": (
            "The answer sheet appears blank or the OCR returned a placeholder.",
            "Ensure your handwriting is legible and the scan is clear.",
        ),
        "too_short": (
            "The extracted answer is too short to evaluate meaningfully.",
            "Write a complete answer — brief answers rarely earn full marks.",
        ),
    }
    ev, fb = messages.get(reason, messages["blank"])
    return {
        "max_marks": max_marks, "marks_awarded": 0,
        "grading_confidence": 1.0,
        "key_points": [], "points_covered": [],
        "points_partially_covered": [], "points_missing": ["Complete answer required"],
        "marks_breakdown": "0 marks — no answer detected",
        "evaluation": ev, "feedback": fb,
        "_parse_stage": "skipped",
    }


def _error_result(max_marks: int, error: str) -> dict:
    return {
        "max_marks": max_marks, "marks_awarded": 0,
        "grading_confidence": 0.0,
        "key_points": [], "points_covered": [],
        "points_partially_covered": [], "points_missing": [],
        "marks_breakdown": "",
        "evaluation": f"Grading failed: {error[:200]}",
        "feedback": "Manual review required. Contact your administrator.",
        "_parse_stage": "error", "_error": error,
    }
