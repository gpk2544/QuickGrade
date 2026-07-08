from __future__ import annotations
from dataclasses import dataclass, field
from typing import List
import os
@dataclass(frozen=True)
class _KBSettings:
    chroma_db_path:   str   = field(default_factory=lambda: os.getenv("CHROMA_DIR", "./chroma_db"))
    collection_name:  str   = "reference_knowledge"
    chunk_size:       int   = 600
    chunk_overlap:    int   = 120
    embed_model:      str   = field(default_factory=lambda: os.getenv("EMBED_MODEL", "all-MiniLM-L6-v2"))
    embed_cache_path: str   = "./.embed_cache.pkl"
    batch_size:       int   = 256
    near_dup_thresh:  float = 0.97
    mmr_lambda:       float = 0.70
KB = _KBSettings()
@dataclass(frozen=True)
class _OCRSettings:
    pdf_render_dpi:        int   = 250
    trocr_batch_size:      int   = 8
    min_text_confidence:   float = 0.30
    min_strip_height:      int   = 25
    max_retries:           int   = 3
    retry_backoff:         float = 1.5
    trocr_model:           str   = "microsoft/trocr-base-handwritten"
    easyocr_cache_dir:     str   = "~/.cache/easyocr"
OCR = _OCRSettings()
@dataclass(frozen=True)
class _RAGSettings:
    max_context_chars:  int = 3000
    default_top_k:      int = 5
    jaccard_sim_thresh: float = 0.70
    stop_words: frozenset = field(default_factory=lambda: frozenset({
        "what", "when", "where", "which", "with", "that", "this", "from",
        "explain", "describe", "discuss", "write", "about", "state", "list",
        "give", "define", "mention", "note", "briefly", "short", "answer",
    }))
RAG = _RAGSettings()
@dataclass(frozen=True)
class _GradingSettings:
    models: tuple = field(default_factory=lambda: (os.getenv("GROQ_MODEL", "llama3-8b-8192"),))
    max_tokens:          int   = 4000
    temperature:         float = 0.3
    max_context_chars:   int   = 3000
    max_answer_chars:    int   = 2000
    max_api_retries:     int   = 4
    rate_limit_sleep:    int   = 20
    noise_ratio_thresh:  float = 0.40
    repetition_thresh:   float = 0.30
    min_answer_words:    int   = 4
GRADING = _GradingSettings()
@dataclass(frozen=True)
class _DBSettings:
    path:          str   = "./grading_results.db"
    schema_ver:    int   = 2
    lock_retries:  int   = 5
    lock_sleep:    float = 0.30
DB = _DBSettings()
@dataclass(frozen=True)
class _AppSettings:
    page_title:      str = "QuickGrade AI"
    page_icon:       str = "🎓"
    default_top_k:   int = 5
    pass_threshold:  float = 35.0
APP = _AppSettings()