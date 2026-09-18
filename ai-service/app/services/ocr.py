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

    # 1. Primary: Try pypdf (pure Python, fast, 100% local text extraction, 0 API calls)
    try:
        from pypdf import PdfReader
        reader = PdfReader(str(path))
        for i, page in enumerate(reader.pages):
            text = (page.extract_text() or "").strip()
            pages.append({"pageNumber": i + 1, "text": text})

        has_content = any(len(p["text"]) > 10 for p in pages)
        if pages and has_content:
            log.info("Successfully extracted %d pages using pypdf locally from %s", len(pages), path.name)
            return pages
    except Exception as ex:
        log.warning("pypdf extraction failed or not installed: %s", ex)

    # 2. Secondary: Try fitz (PyMuPDF) local text extraction (0 API calls)
    try:
        import fitz
        doc = fitz.open(file_path)
        pages = []
        for i, page in enumerate(doc):
            text = (page.get_text("text") or "").strip()
            if not text:
                ocr_text = _ocr_page(page)
                if ocr_text:
                    text = ocr_text.strip()
            pages.append({"pageNumber": i + 1, "text": text})
        doc.close()
        has_content = any(len(p["text"]) > 10 for p in pages)
        if pages and has_content:
            log.info("Successfully extracted %d pages using PyMuPDF locally from %s", len(pages), path.name)
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

