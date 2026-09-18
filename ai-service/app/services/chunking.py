import re


def chunk_pages(pages: list[dict], max_chars: int = 1100, overlap_chars: int = 150) -> list[dict]:
    chunks = []
    for page in pages:
        text = (page.get("text") or "").strip()
        if not text:
            continue
        parts = _split_smart(text, max_chars, overlap_chars)
        for part in parts:
            chunks.append({"pageNumber": page["pageNumber"], "text": part})
    if not chunks and pages:
        chunks.append({"pageNumber": pages[0]["pageNumber"], "text": "No extractable text found."})
    return chunks


def _split_smart(text: str, max_chars: int, overlap_chars: int) -> list[str]:
    # Split text into paragraphs or sentences
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    segments: list[str] = []
    for para in paragraphs:
        if len(para) <= max_chars:
            segments.append(para)
        else:
            sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", para) if s.strip()]
            cur = ""
            for s in sentences:
                if len(s) > max_chars:
                    if cur:
                        segments.append(cur)
                        cur = ""
                    words = s.split()
                    w_cur = ""
                    for w in words:
                        if len(w_cur) + len(w) + 1 <= max_chars:
                            w_cur = f"{w_cur} {w}".strip()
                        else:
                            if w_cur:
                                segments.append(w_cur)
                            w_cur = w
                    if w_cur:
                        segments.append(w_cur)
                    continue

                if len(cur) + len(s) + 1 <= max_chars:
                    cur = f"{cur} {s}".strip()
                else:
                    if cur:
                        segments.append(cur)
                    cur = s
            if cur:
                segments.append(cur)

    chunks: list[str] = []
    current_chunk = ""
    for seg in segments:
        if not current_chunk:
            current_chunk = seg
        elif len(current_chunk) + len(seg) + 1 <= max_chars:
            current_chunk = f"{current_chunk}\n\n{seg}"
        else:
            chunks.append(current_chunk)
            # Retain overlap from end of current_chunk
            overlap_prefix = current_chunk[-overlap_chars:] if len(current_chunk) > overlap_chars else current_chunk
            current_chunk = f"{overlap_prefix} {seg}".strip()

    if current_chunk:
        chunks.append(current_chunk)

    return chunks or [text[:max_chars]]

