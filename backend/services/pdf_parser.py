import io
import pymupdf  
import httpx
async def pdf_bytes_to_text(pdf_bytes: bytes) -> str:
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
        return await _ocr_scanned_pdf(pdf_bytes)
    except Exception as e:
        return f"[PDF extraction error: {e}]"
async def _ocr_scanned_pdf(pdf_bytes: bytes) -> str:
    from services.ocr_service import extract_text_from_bytes
    images = pdf_bytes_to_images(pdf_bytes)
    if not images:
        return "[No pages found in PDF]"
    pages_text = []
    for i, img_bytes in enumerate(images):
        try:
            text = await extract_text_from_bytes(img_bytes)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"OCR error on page {i+1}: {e}")
            text = ""
        if text and not text.startswith("["):
            pages_text.append(f"[Page {i + 1}]\n{text}")
    return (
        "\n\n".join(pages_text)
        if pages_text
        else "[OCR produced no readable text from this PDF]"
    )
def pdf_bytes_to_images(pdf_bytes: bytes, dpi: int = 200) -> list:
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    zoom = dpi / 72
    mat = pymupdf.Matrix(zoom, zoom)
    result = []
    for page in doc:
        pix = page.get_pixmap(matrix=mat, colorspace=pymupdf.csRGB)
        img_bytes = pix.tobytes("jpeg")
        result.append(img_bytes)
    doc.close()
    return result
async def extract_text_from_pdf_url(url: str) -> str:
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.get(url)
    return pdf_bytes_to_text(r.content)