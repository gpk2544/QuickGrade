from __future__ import annotations
import re
from typing import List
from config.settings import KB
from utils.text import clean_whitespace, is_heading
from utils.logger import get_logger
log = get_logger(__name__)
def chunk_text(
    text: str,
    chunk_size: int = KB.chunk_size,
    overlap: int = KB.chunk_overlap,
) -> List[str]:
    text = clean_whitespace(text)
    paragraphs = text.split("\n\n")
    chunks: List[str] = []
    current: List[str] = []
    current_len = 0
    current_heading = ""
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        first_line = para.split("\n")[0]
        if is_heading(first_line):
            current_heading = first_line.strip()
        if len(para) > chunk_size * 2:
            sentences = re.split(r'(?<=[.!?])\s+', para)
            for sent in sentences:
                if current_len + len(sent) > chunk_size and current:
                    chunks.append(_build_chunk(current_heading, current))
                    carry = current[-2:] if len(current) > 2 else current[:]
                    current, current_len = carry, sum(len(s) for s in carry)
                current.append(sent)
                current_len += len(sent)
        else:
            if current_len + len(para) > chunk_size and current:
                chunks.append(_build_chunk(current_heading, current))
                carry = current[-1:]
                current, current_len = carry, len(carry[0]) if carry else 0
            current.append(para)
            current_len += len(para)
    if current:
        chunks.append(_build_chunk(current_heading, current))
    chunks = [c for c in chunks if len(c.split()) > 15]
    log.info("Created %d chunks from %d characters.", len(chunks), len(text))
    return chunks
def _build_chunk(heading: str, parts: List[str]) -> str:
    prefix = f"{heading}\n" if heading else ""
    body   = "\n\n".join(parts)
    return (prefix + body).strip()