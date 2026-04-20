"""OCR Service — extract text from answer sheet images/PDFs

Engine priority:
  1. Google Cloud Vision API (best for handwritten text) - using service account JSON
  2. EasyOCR fallback (pure Python, no external binary needed)

NO external Tesseract binary required.
"""

import os, httpx, base64, io
from utils.logger import get_logger

log = get_logger(__name__)
OCR_ENGINE = os.getenv("OCR_ENGINE", "google")


async def extract_text_google(image_bytes: bytes) -> str:
    """Google Cloud Vision API — uses service account JSON credentials."""
    creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "serviceAccountKey.json")
    log.info(
        f"Google Vision: creds_path={creds_path}, exists={os.path.exists(creds_path) if creds_path else 'N/A'}"
    )

    if not creds_path or not os.path.exists(creds_path):
        log.warning("Google Vision: No credentials file found")
        return ""

    try:
        from google.oauth2 import service_account
        from google.cloud import vision_v1 as vision

        # Load credentials from service account JSON file
        credentials = service_account.Credentials.from_service_account_file(creds_path)

        # Create Vision API client
        client = vision.ImageAnnotatorClient(credentials=credentials)

        # Prepare image
        image = vision.Image(content=image_bytes)

        # Call document text detection (best for handwritten)
        response = client.document_text_detection(
            image=image, image_context={"language_hints": ["en"]}
        )

        # Extract text
        text = (
            response.full_text_annotation.text if response.full_text_annotation else ""
        )
        log.info(f"Google Vision extracted: {len(text)} chars")
        return text if text else ""

    except ImportError:
        log.error("Google Vision: google-cloud-vision not installed")
        return "[OCR error: google-cloud-vision not installed]"
    except Exception as e:
        log.error(f"Google Vision error: {e}")
        return ""
    except Exception as e:
        return ""


def extract_text_easyocr(image_bytes: bytes) -> str:
    """EasyOCR — pure Python fallback, no external binary needed."""
    try:
        import easyocr
        from PIL import Image
        import numpy as np

        # Convert bytes to PIL Image then to numpy array
        img = Image.open(io.BytesIO(image_bytes))
        img_array = np.array(img)

        reader = easyocr.Reader(["en"], gpu=False, verbose=False)
        results = reader.readtext(img_array, detail=1, paragraph=False)

        lines = []
        for _bbox, text, conf in results:
            if conf >= 0.3 and text.strip():
                lines.append(text.strip())

        return "\n".join(lines)
    except ImportError:
        return "[OCR error: easyocr not installed. Run: pip install easyocr]"
    except Exception as e:
        return f"[OCR error: {e}]"


async def extract_text_from_bytes(data: bytes) -> str:
    """Extract text from image bytes using configured OCR engine.

    Priority:
      1. Google Vision (if service account JSON exists)
      2. EasyOCR fallback (pure Python)
    """
    creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "serviceAccountKey.json")
    log.info(f"extract_text_from_bytes: OCR_ENGINE={OCR_ENGINE}, creds={creds_path}")

    # Try Google Vision first
    if OCR_ENGINE == "google" and creds_path and os.path.exists(creds_path):
        result = await extract_text_google(data)
        if result and not result.startswith("["):
            log.info(f"Google Vision success: {len(result)} chars")
            return result
        else:
            log.warning(f"Google Vision failed or empty, falling back to EasyOCR")

    # Fallback to EasyOCR
    return extract_text_easyocr(data)


async def extract_text_from_url(url: str) -> str:
    """Download file from URL and extract text via OCR."""
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.get(url)
    content_type = r.headers.get("content-type", "")
    if "pdf" in content_type:
        from services.pdf_parser import pdf_bytes_to_text

        return pdf_bytes_to_text(r.content)
    return await extract_text_from_bytes(r.content)
