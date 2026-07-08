from __future__ import annotations
from collections import Counter
from typing import Tuple
from config.settings import GRADING
from utils.logger import get_logger
log = get_logger(__name__)
def check(answer: str) -> Tuple[str, str]:
    stripped = answer.strip()
    if not stripped or stripped.startswith("[OCR") or stripped.startswith("[No"):
        return "blank", "Answer is empty or contains an OCR error placeholder."
    words = stripped.split()
    if len(words) < GRADING.min_answer_words:
        return "too_short", f"Only {len(words)} word(s) detected (minimum {GRADING.min_answer_words})."
    alphanum_chars = sum(c.isalnum() or c.isspace() for c in stripped)
    noise_ratio    = 1.0 - alphanum_chars / max(len(stripped), 1)
    if noise_ratio > GRADING.noise_ratio_thresh:
        return (
            "garbled",
            f"High noise ratio ({noise_ratio:.0%}) — likely OCR failure.",
        )
    most_common_count = Counter(w.lower() for w in words).most_common(1)[0][1]
    repetition_ratio  = most_common_count / len(words)
    if repetition_ratio > GRADING.repetition_thresh:
        return (
            "garbled",
            f"Single word repeated {most_common_count}/{len(words)} times — OCR artefact.",
        )
    return "ok", "Answer looks readable."