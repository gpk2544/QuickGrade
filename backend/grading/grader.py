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
_EVAL_CACHE: Dict[str, dict] = {}
def grade(
    question:          str,
    student_answer:    str,
    reference_context: str,
    max_marks:         Optional[int] = None,
) -> dict:
    if max_marks is None:
        max_marks = extract_marks_from_text(question)
    max_marks = max(1, int(max_marks))
    quality_label, quality_reason = check_quality(student_answer)
    log.info("Answer quality: %s — %s", quality_label, quality_reason)
    if quality_label == "blank":
        return _zero_result(max_marks, "blank")
    if quality_label == "too_short":
        return _zero_result(max_marks, "too_short")
    cache_key = hashlib.md5(
        f"{question[:200]}{student_answer[:200]}{max_marks}".encode()
    ).hexdigest()
    if cache_key in _EVAL_CACHE:
        log.info("Evaluation cache hit.")
        return _EVAL_CACHE[cache_key]
    prompt = build_prompt(
        question, student_answer, reference_context, max_marks, quality_label
    )
    try:
        raw_response = llm_call(prompt, SYSTEM_MESSAGE)
        result       = parse_response(raw_response, max_marks)
        result["_model"] = GRADING.models[0]   
    except RuntimeError as exc:
        log.error("LLM call failed: %s", exc)
        return _error_result(max_marks, str(exc))
    _EVAL_CACHE[cache_key] = result
    log.info(
        "Grade: %d/%d (confidence=%.2f, parse_stage=%s)",
        result["marks_awarded"], max_marks,
        result["grading_confidence"], result.get("_parse_stage"),
    )
    return result
from grading.prompt_builder   import build_prompt, build_batch_prompt, SYSTEM_MESSAGE
from grading.llm_client       import call   as llm_call
from grading.response_parser  import parse  as parse_response, parse_batch
def grade_student_batch(
    questions_data: List[dict]
) -> List[dict]:
    if not questions_data:
        return []
    prompt = build_batch_prompt(questions_data)
    max_marks_list = [q["max_marks"] for q in questions_data]
    try:
        raw_response = llm_call(prompt, SYSTEM_MESSAGE)
        results = parse_batch(raw_response, max_marks_list)
        return results
    except Exception as e:
        log.error(f"Batch grading failed: {e}")
        log.info("Falling back to sequential grading...")
        results = []
        for q in questions_data:
            results.append(grade(q["question"], q["student_answer"], q["reference_context"], q["max_marks"]))
        return results
def clear_cache() -> None:
    _EVAL_CACHE.clear()
    log.info("Evaluation cache cleared.")
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