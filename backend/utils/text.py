from __future__ import annotations
import re
from typing import List
def clean_whitespace(text: str) -> str:
    return re.sub(r'\n{3,}', '\n\n', text).strip()
def extract_marks_from_text(text: str) -> int:
    patterns_by_priority = [
        (3, r'\((\d{1,3})\s*marks?\)'),
        (3, r'\[(\d{1,3})\s*marks?\]'),
        (2, r'(?:for|worth|carries?)\s+(\d{1,3})\s*marks?'),
        (2, r'(\d{1,3})\s*marks?'),
        (1, r'\((\d{1,3})\)'),
    ]
    best_priority, best_val = 0, 10
    for priority, pattern in patterns_by_priority:
        for m in re.finditer(pattern, text, re.IGNORECASE):
            val = int(m.group(1))
            if 1 <= val <= 100 and priority > best_priority:
                best_priority, best_val = priority, val
    return best_val
def trim_to_budget(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    truncated = text[:max_chars]
    last_sent = max(truncated.rfind('. '), truncated.rfind('.\n'))
    if last_sent > max_chars * 0.6:
        truncated = truncated[:last_sent + 1]
    return truncated + "\n[... truncated for length ...]"
def is_heading(line: str) -> bool:
    stripped = line.strip()
    if not stripped or len(stripped) > 80:
        return False
    if stripped.isupper() and len(stripped.split()) <= 8:
        return True
    if re.match(r'^[A-Z][a-z]+ [A-Z]', stripped) and not stripped.endswith(('.', ':')):
        if len(stripped.split()) <= 6:
            return True
    return False
def jaccard_similarity(a: str, b: str) -> float:
    sa, sb = set(a.lower().split()), set(b.lower().split())
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)
def fuzzy_deduplicate(lines: List[str], threshold: float = 0.85) -> List[str]:
    kept: List[str] = []
    for line in lines:
        if all(jaccard_similarity(line, k) < threshold for k in kept):
            kept.append(line)
    return kept