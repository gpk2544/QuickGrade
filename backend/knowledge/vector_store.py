"""
knowledge/vector_store.py
==========================
Responsibility: all ChromaDB read/write operations.
Does NOT handle chunking, embedding computation, or PDF loading —
those concerns live in their own modules.
"""

from __future__ import annotations

import hashlib
import os
from typing import List, Tuple

import chromadb
import numpy as np

from config.settings import KB
from knowledge.embedder import get_embed_fn, embed_texts, cosine_similarity
from utils.logger import get_logger

log = get_logger(__name__)


def _get_collection():
    """Return (or create) the ChromaDB collection."""
    client = chromadb.PersistentClient(path=KB.chroma_db_path)
    return client.get_or_create_collection(
        name=KB.collection_name,
        embedding_function=get_embed_fn(),
        metadata={"hnsw:space": "cosine"},
    )


def _pdf_fingerprint(pdf_path: str) -> str:
    """Fast stable ID for a PDF: MD5 of its first 64 KB."""
    with open(pdf_path, "rb") as f:
        return hashlib.md5(f.read(65536)).hexdigest()


# ─── Write ────────────────────────────────────────────────────────────────────

def upsert_chunks(
    chunks: List[str],
    pdf_path: str,
    fingerprint: str,
) -> int:
    """
    Upsert *chunks* into ChromaDB with stable IDs.

    Args:
        chunks:      List of text chunks to store.
        pdf_path:    Source PDF path (used in metadata).
        fingerprint: PDF fingerprint for dedup checks.

    Returns:
        Total number of chunks now in the collection.
    """
    collection = _get_collection()

    # Clear old data before re-indexing
    if collection.count() > 0:
        log.info("Clearing %d existing chunks…", collection.count())
        collection.delete(where={"source": {"$ne": "__never__"}})

    ids, documents, metadatas = [], [], []
    for i, chunk in enumerate(chunks):
        chunk_id = hashlib.md5(f"{fingerprint}_{i}_{chunk[:40]}".encode()).hexdigest()
        ids.append(chunk_id)
        documents.append(chunk)
        metadatas.append({
            "source":          os.path.basename(pdf_path),
            "chunk_index":     i,
            "pdf_fingerprint": fingerprint,
        })

    for start in range(0, len(ids), KB.batch_size):
        end = start + KB.batch_size
        collection.upsert(
            ids=ids[start:end],
            documents=documents[start:end],
            metadatas=metadatas[start:end],
        )
        log.info(
            "Upserted batch %d/%d",
            start // KB.batch_size + 1,
            (len(ids) - 1) // KB.batch_size + 1,
        )

    total = collection.count()
    log.info("Collection now holds %d chunks.", total)
    return total


def is_already_indexed(fingerprint: str) -> bool:
    """Return True if a PDF with this fingerprint is already in the store."""
    coll = _get_collection()
    if coll.count() == 0:
        return False
    meta = coll.get(limit=1, include=["metadatas"])
    if meta["metadatas"]:
        return meta["metadatas"][0].get("pdf_fingerprint") == fingerprint
    return False


# ─── Read ─────────────────────────────────────────────────────────────────────

def query_chunks(query: str, top_k: int = 5, use_mmr: bool = True) -> List[str]:
    """
    Retrieve *top_k* relevant chunks for *query*.

    When use_mmr=True, applies Maximal Marginal Relevance (λ=KB.mmr_lambda)
    to return diverse, non-redundant results.

    Returns:
        List of chunk texts (may be fewer than top_k if collection is small).
    """
    collection = _get_collection()
    if collection.count() == 0:
        return ["[Knowledge base is empty. Upload a reference PDF first.]"]

    n_candidates = min(top_k * 3, collection.count()) if use_mmr else min(top_k, collection.count())

    results = collection.query(
        query_texts=[query],
        n_results=n_candidates,
        include=["documents", "embeddings"],
    )
    docs      = results.get("documents", [[]])[0]
    cand_vecs = np.array(results["embeddings"][0]) if results.get("embeddings") else None

    if not docs:
        return ["[No relevant context found.]"]
    if not use_mmr or len(docs) <= top_k or cand_vecs is None:
        return docs[:top_k]

    return _mmr_select(query, docs, cand_vecs, top_k)


def _mmr_select(
    query: str,
    docs: List[str],
    cand_vecs: np.ndarray,
    top_k: int,
) -> List[str]:
    """Maximal Marginal Relevance selection from candidate documents."""
    query_vec = embed_texts([query])[0]
    selected:  List[int] = []
    remaining: List[int] = list(range(len(docs)))

    while len(selected) < top_k and remaining:
        best_idx, best_score = None, -1e9
        for i in remaining:
            relevance = cosine_similarity(query_vec, cand_vecs[i])
            diversity = (
                1 - max(cosine_similarity(cand_vecs[i], cand_vecs[j]) for j in selected)
                if selected else 1.0
            )
            score = KB.mmr_lambda * relevance + (1 - KB.mmr_lambda) * diversity
            if score > best_score:
                best_score, best_idx = score, i
        selected.append(best_idx)
        remaining.remove(best_idx)

    return [docs[i] for i in selected]


def get_stats() -> dict:
    """Return collection statistics."""
    try:
        coll  = _get_collection()
        count = coll.count()
        source = ""
        if count > 0:
            meta = coll.get(limit=1, include=["metadatas"])
            source = (meta["metadatas"] or [{}])[0].get("source", "")
        return {"status": "ready" if count > 0 else "empty", "chunks": count, "source": source}
    except Exception as exc:
        return {"status": "error", "chunks": 0, "error": str(exc)}
