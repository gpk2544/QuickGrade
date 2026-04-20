"""PDF Parser — extract text from PDF files for RAG indexing

Uses PyMuPDF (pymupdf) for all PDF operations:
  - Text extraction from digital PDFs (fast, no OCR needed)
  - Page rendering to images for scanned PDFs (replaces pdf2image + Poppler)

NO external binaries required (no Tesseract, no Poppler).
"""

import io
import pymupdf  # PyMuPDF (formerly fitz)
import httpx


def pdf_bytes_to_text(pdf_bytes: bytes) -> str:
    """
    Extract text from a PDF.

    Strategy:
      1. Try PyMuPDF embedded text extraction first (fast, free).
      2. If the PDF is scanned (no embedded text), fall back to OCR
         via Google Vision or EasyOCR (handled by ocr_service).

    Returns:
        Extracted text string, or an error message on failure.
    """
    try:
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        pages_text = []
        has_text = False

        for i, page in enumerate(doc):
            text = page.get_text("text").strip()
            if text:
                has_text = True
                pages_text.append(f"[Page {i + 1}]\n{text}")

        doc.close()

        if has_text:
            return "\n\n".join(pages_text)

        # Scanned PDF — render to images and OCR each page
        return _ocr_scanned_pdf(pdf_bytes)

    except Exception as e:
        return f"[PDF extraction error: {e}]"


def _ocr_scanned_pdf(pdf_bytes: bytes) -> str:
    """OCR a scanned PDF by rendering pages to images and running OCR."""
    import asyncio
    from services.ocr_service import extract_text_from_bytes

    images = pdf_bytes_to_images(pdf_bytes)
    if not images:
        return "[No pages found in PDF]"

    pages_text = []
    for i, img_bytes in enumerate(images):
        try:
            # Run async OCR in sync context
            loop = asyncio.new_event_loop()
            text = loop.run_until_complete(extract_text_from_bytes(img_bytes))
            loop.close()
        except Exception:
            text = ""
        if text and not text.startswith("["):
            pages_text.append(f"[Page {i + 1}]\n{text}")

    return (
        "\n\n".join(pages_text)
        if pages_text
        else "[OCR produced no readable text from this PDF]"
    )


def pdf_bytes_to_images(pdf_bytes: bytes, dpi: int = 200) -> list:
    """
    Render every PDF page to JPEG bytes using PyMuPDF.

    Replaces pdf2image (which required Poppler).
    Returns a list of JPEG byte strings.
    """
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    zoom = dpi / 72
    mat = pymupdf.Matrix(zoom, zoom)
    result = []

    for page in doc:
        pix = page.get_pixmap(matrix=mat, colorspace=pymupdf.csRGB)
        # Convert pixmap to JPEG bytes
        img_bytes = pix.tobytes("jpeg")
        result.append(img_bytes)

    doc.close()
    return result


async def extract_text_from_pdf_url(url: str) -> str:
    """Download PDF from URL and extract text."""
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.get(url)
    return pdf_bytes_to_text(r.content)
