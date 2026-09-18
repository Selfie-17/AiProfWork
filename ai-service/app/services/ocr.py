from __future__ import annotations

import logging
from pathlib import Path

log = logging.getLogger("ai.ocr")


def extract_pages(file_path: str) -> list[dict]:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(file_path)
    
    # Handle plain text documents directly
    if path.suffix.lower() in [".txt", ".md", ".json", ".csv"]:
        try:
            content = path.read_text(encoding="utf-8", errors="replace")
            return [{"pageNumber": 1, "text": content}]
        except Exception as ex:
            log.warning("Plain text read failed: %s", ex)

    pages = []

    # 1. Primary: Try pypdf (pure Python, cross-platform, zero C-compiler dependency)
    try:
        from pypdf import PdfReader
        reader = PdfReader(str(path))
        for i, page in enumerate(reader.pages):
            text = (page.extract_text() or "").strip()
            pages.append({"pageNumber": i + 1, "text": text})
        
        # Check if any page has text, or if images need multi-modal transcription
        for i, page in enumerate(reader.pages):
            p_text = pages[i]["text"]
            if len(p_text.strip()) < 40 and hasattr(page, "images") and len(page.images) > 0:
                log.info("Page %d has little text (%d chars) but contains %d images. Invoking Gemini Vision...", i + 1, len(p_text), len(page.images))
                vision_texts = []
                for img in list(page.images)[:2]:
                    v_res = _gemini_vision_transcribe(img.data)
                    if v_res:
                        vision_texts.append(v_res)
                if vision_texts:
                    pages[i]["text"] = (p_text + "\n\n[Visual Content Transcription]:\n" + "\n".join(vision_texts)).strip()

        has_content = any(len(p["text"]) > 10 for p in pages)
        if pages and has_content:
            log.info("Successfully extracted %d pages using pypdf + vision from %s", len(pages), path.name)
            return pages
    except Exception as ex:
        log.warning("pypdf extraction failed or not installed: %s", ex)

    # 2. Secondary: Try fitz (PyMuPDF)
    try:
        import fitz
        doc = fitz.open(file_path)
        pages = []
        for i, page in enumerate(doc):
            text = page.get_text("text") or ""
            if len(text.strip()) < 40:
                pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5))
                v_res = _gemini_vision_transcribe(pix.tobytes("png"))
                if v_res:
                    text = v_res
                else:
                    ocr_text = _ocr_page(page)
                    if ocr_text:
                        text = ocr_text
            pages.append({"pageNumber": i + 1, "text": text})
        doc.close()
        if pages:
            log.info("Successfully extracted %d pages using PyMuPDF from %s", len(pages), path.name)
            return pages
    except Exception as ex:
        log.warning("PyMuPDF fallback failed: %s", ex)

    # 3. Final Fallback: read bytes gracefully
    log.warning("All PDF extractors failed, using plain byte fallback for %s", path.name)
    data = path.read_bytes()
    try:
        text = data.decode("utf-8", errors="ignore")
    except Exception:
        text = ""
    return [{"pageNumber": 1, "text": text or f"(unreadable file {path.name})"}]


def _gemini_vision_transcribe(image_bytes: bytes) -> str:
    import httpx
    from app.services.provider_manager import provider_manager
    key, _, is_active = provider_manager.get_active_credentials("GEMINI")
    if not key or not is_active or not image_bytes:
        return ""
    import base64
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    for model in ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-flash-lite"]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        headers = {
            "x-goog-api-key": key,
            "Content-Type": "application/json",
        }
        body = {
            "contents": [{
                "parts": [
                    {"text": "Transcribe this document page completely and accurately into clean markdown, including any tables, math formulas in LaTeX ($...$), and concise explanations of figures/diagrams."},
                    {"inline_data": {"mime_type": "image/png", "data": b64}}
                ]
            }]
        }
        try:
            r = httpx.post(url, headers=headers, json=body, timeout=35)
            if r.status_code == 200:
                candidates = r.json().get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts and "text" in parts[0]:
                        return parts[0]["text"]
        except Exception as ex:
            log.warning("Gemini Vision OCR attempt (%s) failed: %s", model, ex)
    return ""


def _ocr_page(page) -> str:
    try:
        import fitz
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        import tempfile, subprocess
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            pix.save(tmp.name)
            result = subprocess.run(
                ["tesseract", tmp.name, "stdout"],
                capture_output=True,
                text=True,
                timeout=30,
            )
            return result.stdout or ""
    except Exception as ex:
        log.info("OCR skipped: %s", ex)
        return ""

