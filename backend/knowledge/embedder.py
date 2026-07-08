from __future__ import annotations
import hashlib
import os
import pickle
from typing import List, Dict
import numpy as np
from chromadb.utils import embedding_functions
from config.settings import KB
from utils.logger import get_logger
log = get_logger(__name__)
_embed_cache: Dict[str, List[float]] = {}
_embed_fn = None
def _load_cache() -> None:
    global _embed_cache
    if os.path.exists(KB.embed_cache_path):
        try:
            with open(KB.embed_cache_path, "rb") as f:
                _embed_cache = pickle.load(f)
            log.info("Loaded %d cached embeddings.", len(_embed_cache))
        except Exception as exc:
            log.warning("Could not read embed cache: %s", exc)
            _embed_cache = {}
def _save_cache() -> None:
    try:
        with open(KB.embed_cache_path, "wb") as f:
            pickle.dump(_embed_cache, f)
    except Exception as exc:
        log.warning("Could not save embed cache: %s", exc)
_load_cache()
def get_embed_fn():
    global _embed_fn
    if _embed_fn is None:
        _embed_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name=KB.embed_model
        )
    return _embed_fn
def embed_texts(texts: List[str]) -> np.ndarray:
    embed_fn = get_embed_fn()
    results = [None] * len(texts)
    uncached_texts, uncached_indices = [], []
    for i, t in enumerate(texts):
        key = hashlib.md5(t.encode()).hexdigest()
        if key in _embed_cache:
            results[i] = np.array(_embed_cache[key], dtype=np.float32)
        else:
            uncached_texts.append(t)
            uncached_indices.append(i)
    if uncached_texts:
        log.info("Computing embeddings for %d new texts…", len(uncached_texts))
        new_vecs = embed_fn(uncached_texts)
        for text, vec, idx in zip(uncached_texts, new_vecs, uncached_indices):
            arr = np.array(vec, dtype=np.float32)
            _embed_cache[hashlib.md5(text.encode()).hexdigest()] = vec
            results[idx] = arr
        _save_cache()
    return np.stack(results)
def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))
def deduplicate_chunks(chunks: List[str], threshold: float = KB.near_dup_thresh) -> List[str]:
    if len(chunks) <= 1:
        return chunks
    log.info("Deduplicating %d chunks (threshold=%.2f)…", len(chunks), threshold)
    vecs = embed_texts(chunks)
    kept: List[int] = []
    for i in range(len(chunks)):
        replaced = False
        for j_pos, j in enumerate(kept):
            if cosine_similarity(vecs[i], vecs[j]) >= threshold:
                if len(chunks[i]) > len(chunks[j]):
                    kept[j_pos] = i      
                replaced = True
                break
        if not replaced:
            kept.append(i)
    result = [chunks[i] for i in sorted(set(kept))]
    log.info("After dedup: %d unique chunks (removed %d).", len(result), len(chunks) - len(result))
    return result