"""
knowledge/chunker.py
=====================
Responsibility: split a long document string into overlapping,
semantically-coherent chunks ready for embedding.

Logic:
  1. Split on paragraph boundaries (double newline).
  2. Track section headings and prepend them for context.
  3. Merge short paragraphs up to chunk_size.
  4. Split oversized paragraphs at sentence boundaries.
  5. Filter micro-chunks (< 15 words).
"""

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
    """
    Split *text* into overlapping semantic chunks.

    Args:
        text:       Full document text.
        chunk_size: Target character length per chunk.
        overlap:    Characters of overlap kept when starting a new chunk.

    Returns:
        List of non-empty chunk strings.
    """
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

        # Track nearest heading for context injection
        first_line = para.split("\n")[0]
        if is_heading(first_line):
            current_heading = first_line.strip()

        if len(para) > chunk_size * 2:
            # Paragraph too long → split at sentence boundaries
            sentences = re.split(r'(?<=[.!?])\s+', para)
            for sent in sentences:
                if current_len + len(sent) > chunk_size and current:
                    chunks.append(_build_chunk(current_heading, current))
                    # Overlap: retain last two sentences
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

    # Flush remainder
    if current:
        chunks.append(_build_chunk(current_heading, current))

    # Drop micro-chunks
    chunks = [c for c in chunks if len(c.split()) > 15]
    log.info("Created %d chunks from %d characters.", len(chunks), len(text))
    return chunks


def _build_chunk(heading: str, parts: List[str]) -> str:
    """Assemble heading + body parts into a single chunk string."""
    prefix = f"{heading}\n" if heading else ""
    body   = "\n\n".join(parts)
    return (prefix + body).strip()
