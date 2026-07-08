from __future__ import annotations
from typing import List, Tuple
from knowledge.pdf_loader  import load_pdf_text
from knowledge.chunker     import chunk_text
from knowledge.embedder    import deduplicate_chunks
from knowledge.vector_store import (
    upsert_chunks, is_already_indexed, query_chunks,
    get_stats, _pdf_fingerprint,
)
from utils.logger import get_logger
log = get_logger(__name__)
def build(pdf_path: str, force_rebuild: bool = False) -> Tuple[int, str]:
    fingerprint = _pdf_fingerprint(pdf_path)
    if not force_rebuild and is_already_indexed(fingerprint):
        from knowledge.vector_store import get_stats as _gs
        n = _gs()["chunks"]
        msg = f"Already indexed ({n} chunks). Use force_rebuild=True to re-index."
        log.info(msg)
        return n, msg
    raw_text = load_pdf_text(pdf_path)
    if not raw_text.strip():
        return 0, "No text extracted from the PDF."
    chunks = chunk_text(raw_text)
    chunks = deduplicate_chunks(chunks)
    total = upsert_chunks(chunks, pdf_path, fingerprint)
    msg = f"Knowledge base built: {total} chunks from '{pdf_path}'."
    log.info(msg)
    return total, msg
def retrieve(query: str, top_k: int = 5, use_mmr: bool = True) -> List[str]:
    return query_chunks(query, top_k=top_k, use_mmr=use_mmr)
def stats() -> dict:
    return get_stats()