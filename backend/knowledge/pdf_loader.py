"""
knowledge/pdf_loader.py
========================
Responsibility: open a PDF file and return its plain text.
Single-purpose module; no chunking, no embedding logic here.
"""

import pymupdf  # PyMuPDF (formerly fitz)
from utils.logger import get_logger

log = get_logger(__name__)


def load_pdf_text(pdf_path: str) -> str:
    """
    Extract all text from a PDF using PyMuPDF, preserving page labels.

    Args:
        pdf_path: Absolute or relative path to the PDF file.

    Returns:
        Full document text with [Page N] markers.

    Raises:
        FileNotFoundError: If the PDF does not exist.
        RuntimeError: If PyMuPDF cannot open the file.
    """
    import os

    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    try:
        doc = pymupdf.open(pdf_path)
    except Exception as exc:
        raise RuntimeError(f"Cannot open PDF '{pdf_path}': {exc}") from exc

    pages = []
    for i, page in enumerate(doc):
        text = page.get_text("text").strip()
        if text:
            pages.append(f"[Page {i + 1}]\n{text}")
    doc.close()

    full_text = "\n\n".join(pages)
    log.info(
        "Loaded '%s': %d chars from %d pages.", pdf_path, len(full_text), len(pages)
    )
    return full_text
