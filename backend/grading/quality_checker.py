"""
grading/quality_checker.py
===========================
Responsibility: classify student answer text quality BEFORE calling the LLM.

Catches obvious problems early so we don't waste API quota on blank or
completely garbled OCR output.

Returns a (quality_label, reason) tuple:
  'ok'         — answer looks readable, proceed to LLM
  'blank'      — empty or placeholder string
  'too_short'  — fewer than MIN_ANSWER_WORDS meaningful words
  'garbled'    — high noise ratio or pathological word repetition
"""

from __future__ import annotations

from collections import Counter
from typing import Tuple

from config.settings import GRADING
from utils.logger import get_logger

log = get_logger(__name__)


def check(answer: str) -> Tuple[str, str]:
    """
    Analyse *answer* and return (quality_label, human_readable_reason).

    Args:
        answer: Raw OCR-extracted or manually entered student answer.

    Returns:
        ('ok' | 'blank' | 'too_short' | 'garbled',  reason_string)
    """
    stripped = answer.strip()

    # ── Blank / placeholder ───────────────────────────────────────────────
    if not stripped or stripped.startswith("[OCR") or stripped.startswith("[No"):
        return "blank", "Answer is empty or contains an OCR error placeholder."

    # ── Too short ─────────────────────────────────────────────────────────
    words = stripped.split()
    if len(words) < GRADING.min_answer_words:
        return "too_short", f"Only {len(words)} word(s) detected (minimum {GRADING.min_answer_words})."

    # ── High noise ratio (OCR garbage) ───────────────────────────────────
    alphanum_chars = sum(c.isalnum() or c.isspace() for c in stripped)
    noise_ratio    = 1.0 - alphanum_chars / max(len(stripped), 1)
    if noise_ratio > GRADING.noise_ratio_thresh:
        return (
            "garbled",
            f"High noise ratio ({noise_ratio:.0%}) — likely OCR failure.",
        )

    # ── Pathological repetition (OCR stuck in a loop) ────────────────────
    most_common_count = Counter(w.lower() for w in words).most_common(1)[0][1]
    repetition_ratio  = most_common_count / len(words)
    if repetition_ratio > GRADING.repetition_thresh:
        return (
            "garbled",
            f"Single word repeated {most_common_count}/{len(words)} times — OCR artefact.",
        )

    return "ok", "Answer looks readable."
