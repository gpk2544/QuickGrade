"""
grading/response_parser.py
===========================
Responsibility: turn the LLM's raw string response into a validated
Python dict with all required fields and clamped numeric values.

Three-stage repair strategy:
  Stage 1 — standard json.loads after stripping markdown fences.
  Stage 2 — fix common structural errors (trailing commas, unquoted keys).
  Stage 3 — field-by-field regex extraction (last resort).
"""

from __future__ import annotations

import json
import re
from typing import Any, List, Optional

from utils.logger import get_logger

log = get_logger(__name__)

# Fields that must be lists in the final result
_LIST_FIELDS = (
    "key_points",
    "points_covered",
    "points_partially_covered",
    "points_missing",
)


def parse(raw: str, max_marks: int) -> dict:
    """
    Parse *raw* LLM output into a validated grading result dict.

    Always returns a complete dict — never raises.
    Sets '_parse_stage' to 'json' | 'repaired' | 'regex_fallback'
    so callers can surface parse quality to the user.

    Args:
        raw:       Raw string from the LLM.
        max_marks: Maximum marks ceiling for validation.

    Returns:
        Validated dict with all required grading fields.
    """
    result, stage = _try_stages(raw)
    if result is None:
        log.error("All parse stages failed. Using empty skeleton.")
        result = {}
        stage  = "failed"

    return _validate(result, max_marks, stage)


# ─── Parse stages ─────────────────────────────────────────────────────────────

def _try_stages(raw: str):
    """Try three parse strategies in order. Return (dict, stage_label) or (None, None)."""

    # Stage 1: clean fences → json.loads
    cleaned = re.sub(r'```(?:json)?\s*', '', raw).strip().strip('`').strip()
    json_match = re.search(r'\{.*\}', cleaned, re.DOTALL)
    if json_match:
        cleaned = json_match.group()
    try:
        return json.loads(cleaned), "json"
    except json.JSONDecodeError:
        pass

    # Stage 2: fix trailing commas + unquoted keys → json.loads
    fixed = re.sub(r',(\s*[}\]])', r'\1', cleaned)            # trailing commas
    fixed = re.sub(r'(?<=[{,])\s*(\w+)\s*:', r'"\1":', fixed) # unquoted keys
    fixed = re.sub(r":\s*'([^']*)'", r': "\1"', fixed)        # single-quoted values
    try:
        return json.loads(fixed), "repaired"
    except json.JSONDecodeError:
        pass

    # Stage 3: field-by-field regex extraction
    log.warning("Stages 1 & 2 failed — using regex field extraction.")
    result = {
        "marks_awarded":            _extract_number(raw, "marks_awarded",         0),
        "grading_confidence":       _extract_number(raw, "grading_confidence",     0.5),
        "key_points":               _extract_list  (raw, "key_points"),
        "points_covered":           _extract_list  (raw, "points_covered"),
        "points_partially_covered": _extract_list  (raw, "points_partially_covered"),
        "points_missing":           _extract_list  (raw, "points_missing"),
        "marks_breakdown":          _extract_str   (raw, "marks_breakdown"),
        "evaluation":               _extract_str   (raw, "evaluation",   "Evaluation unavailable."),
        "feedback":                 _extract_str   (raw, "feedback",     "See key points above."),
    }
    return result, "regex_fallback"


# ─── Regex extractors ─────────────────────────────────────────────────────────

def _extract_number(raw: str, field: str, default) -> Any:
    m = re.search(rf'"{field}"\s*:\s*([0-9.]+)', raw)
    if m:
        try:
            return float(m.group(1)) if '.' in m.group(1) else int(m.group(1))
        except ValueError:
            pass
    return default


def _extract_str(raw: str, field: str, default: str = "") -> str:
    m = re.search(rf'"{field}"\s*:\s*"([^"]*)"', raw, re.DOTALL)
    return m.group(1).strip() if m else default


def _extract_list(raw: str, field: str) -> List[str]:
    m = re.search(rf'"{field}"\s*:\s*\[([^\]]*)\]', raw, re.DOTALL)
    if not m:
        return []
    items = re.findall(r'"([^"]+)"', m.group(1))
    return [i.strip() for i in items if i.strip()]


# ─── Validation / sanitisation ────────────────────────────────────────────────

def _to_int(v: Any, default: int = 0) -> int:
    try:
        return int(round(float(str(v))))
    except (ValueError, TypeError):
        return default


def _to_float(v: Any, default: float = 0.5) -> float:
    try:
        return max(0.0, min(1.0, float(str(v))))
    except (ValueError, TypeError):
        return default


def _to_list(v: Any) -> List[str]:
    if isinstance(v, list):
        return [str(x) for x in v if x]
    if isinstance(v, str) and v:
        return [v]
    return []


def _validate(raw_dict: dict, max_marks: int, stage: str) -> dict:
    """Sanitise types, clamp marks, and fill missing fields."""
    marks_awarded = _to_int(raw_dict.get("marks_awarded", 0))
    marks_awarded = max(0, min(marks_awarded, max_marks))   # hard clamp

    return {
        "max_marks":                max_marks,
        "marks_awarded":            marks_awarded,
        "grading_confidence":       _to_float(raw_dict.get("grading_confidence", 0.7)),
        "key_points":               _to_list(raw_dict.get("key_points")),
        "points_covered":           _to_list(raw_dict.get("points_covered")),
        "points_partially_covered": _to_list(raw_dict.get("points_partially_covered")),
        "points_missing":           _to_list(raw_dict.get("points_missing")),
        "marks_breakdown":          str(raw_dict.get("marks_breakdown", "")),
        "evaluation":               str(raw_dict.get("evaluation",      "Evaluation completed.")),
        "feedback":                 str(raw_dict.get("feedback",        "Review the key points above.")),
        "_parse_stage":             stage,
    }
