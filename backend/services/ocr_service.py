import os
import httpx
import base64
import io
from PIL import Image
import numpy as np

from utils.logger import get_logger

log = get_logger(__name__)

OCR_ENGINE = os.getenv("OCR_ENGINE", "google")

def get_creds_path():
    possible_paths = [
        os.getenv("GOOGLE_APPLICATION_CREDENTIALS"),
        "serviceAccountKey.json",
        "backend/serviceAccountKey.json",
        os.path.join(os.path.dirname(__file__), "..", "serviceAccountKey.json")
    ]
    for path in possible_paths:
        if path and os.path.exists(path):
            return path
    return None

async def extract_text_google(image_bytes: bytes) -> str:
    creds_path = get_creds_path()
    log.info(f"Google Vision: creds_path={creds_path}, exists={os.path.exists(creds_path) if creds_path else 'N/A'}")
    
    if not creds_path:
        log.warning("Google Vision: No credentials file found")
        return ""
        
    try:
        from google.oauth2 import service_account
        from google.cloud import vision_v1 as vision
        credentials = service_account.Credentials.from_service_account_file(creds_path)
        client = vision.ImageAnnotatorClient(credentials=credentials)
        image = vision.Image(content=image_bytes)
        response = client.document_text_detection(
            image=image, image_context={"language_hints": ["en"]}
        )
        text = response.full_text_annotation.text if response.full_text_annotation else ""
        log.info(f"Google Vision extracted: {len(text)} chars")
        return text if text else ""
    except ImportError:
        log.error("Google Vision: google-cloud-vision not installed")
        return "[OCR error: google-cloud-vision not installed]"
    except Exception as e:
        log.error(f"Google Vision error: {e}")
        return ""

_easyocr_reader = None
_trocr_processor = None
_trocr_model = None

def get_hybrid_ocr():
    global _easyocr_reader, _trocr_processor, _trocr_model
    try:
        if _easyocr_reader is None:
            import easyocr
            log.info("🚀 Loading EasyOCR Reader...")
            _easyocr_reader = easyocr.Reader(["en"], gpu=False) 
            
        if _trocr_processor is None:
            from transformers import TrOCRProcessor, VisionEncoderDecoderModel
            import torch
            log.info("🚀 Loading TrOCR Models (this may take a minute on first run)...")
            model_id = "microsoft/trocr-base-handwritten"
            _trocr_processor = TrOCRProcessor.from_pretrained(model_id)
            _trocr_model = VisionEncoderDecoderModel.from_pretrained(model_id)
            if torch.cuda.is_available():
                _trocr_model.to("cuda")
                log.info("✅ TrOCR using GPU")
            else:
                log.info("ℹ️ TrOCR using CPU")
        return _easyocr_reader, _trocr_processor, _trocr_model
    except Exception as e:
        log.error(f"Failed to load hybrid OCR models: {e}")
        return None, None, None

def extract_text_hybrid(image_bytes: bytes) -> str:
    try:
        import torch
        reader, processor, model = get_hybrid_ocr()
        if not reader:
            return "[OCR error: Could not load local AI models]"
            
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_array = np.array(img)
        
        log.info("Detecting text regions with EasyOCR...")
        bounds = reader.readtext(img_array)
        if not bounds:
            return ""
            
        log.info(f"Recognizing {len(bounds)} text regions with TrOCR...")
        device = "cuda" if torch.cuda.is_available() else "cpu"
        final_text = []
        
        for box, detected_text, conf in bounds:
            x_coords = [p[0] for p in box]
            y_coords = [p[1] for p in box]
            left, top, right, bottom = min(x_coords), min(y_coords), max(x_coords), max(y_coords)
            pad = 2
            cropped_img = img.crop((left-pad, top-pad, right+pad, bottom+pad))
            pixel_values = processor(images=cropped_img, return_tensors="pt").pixel_values.to(device)
            generated_ids = model.generate(pixel_values)
            generated_text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
            final_text.append(generated_text)
            
        return "\n".join(final_text)
    except ImportError as e:
        log.warning(f"AI libraries missing: {e}")
        return "[OCR error: AI libraries missing]"
    except Exception as e:
        log.error(f"Hybrid OCR error: {e}")
        return f"[OCR error: {e}]"

async def extract_text_from_bytes(data: bytes) -> str:
    creds_path = get_creds_path()
    if OCR_ENGINE == "google" and creds_path:
        result = await extract_text_google(data)
        if result and not result.startswith("["):
            return result
        log.warning("Google Vision failed/disabled, falling back to Hybrid Local AI...")
        
    from fastapi.concurrency import run_in_threadpool
    return await run_in_threadpool(extract_text_hybrid, data)

async def extract_text_from_url(url: str) -> str:
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.get(url)
    content_type = r.headers.get("content-type", "")
    if "pdf" in content_type:
        from services.pdf_parser import pdf_bytes_to_text
        return await pdf_bytes_to_text(r.content)
    return await extract_text_from_bytes(r.content)