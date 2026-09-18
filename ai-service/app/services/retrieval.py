from __future__ import annotations

import re
from app.core.config import settings
from app.core.db import db
from app.services.llm_client import cosine, embed_text

STOP = {
    "a", "an", "the", "and", "or", "of", "to", "in", "on", "for", "is", "are", "was", "were",
    "be", "this", "that", "it", "with", "as", "by", "from", "at", "your", "my", "me", "we",
    "you", "what", "which", "how", "why", "when", "where", "does", "do", "did", "can", "could",
    "please", "tell", "about", "give", "explain",
}

OVERVIEW_RE = re.compile(
    r"\b(summar(y|ize|ise)|overview|main (idea|topic|points)|key (points|ideas|concepts)|"
    r"what (is|does|are) (this|the) (pdf|document|note|material|file)|"
    r"uploaded (pdf|notes|material)|contents of|"
    r"explain (the )?(material|notes|document|pdf)|study guide|what is this)\b",
    re.I,
)

GREETING_RE = re.compile(
    r"^\s*(hi|hello|hey|greetings|help|howdy|good\s+(morning|afternoon|evening)|who are you|what can you do)\b",
    re.I,
)


def tokenize(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9]+", (text or "").lower()) if t not in STOP and len(t) > 1]


def lexical_score(query_tokens: list[str], text: str) -> float:
    if not query_tokens:
        return 0.0
    words = set(tokenize(text))
    if not words:
        return 0.0
    hits = sum(1 for t in query_tokens if t in words)
    return hits / len(query_tokens)


def is_overview_question(query: str) -> bool:
    return bool(OVERVIEW_RE.search(query or ""))


def is_greeting(query: str) -> bool:
    return bool(GREETING_RE.search(query or ""))


def project_filter(project_id: str) -> dict:
    ors: list[dict] = [{"projectId": str(project_id)}]
    try:
        from bson import ObjectId
        oid = ObjectId(project_id)
        ors.append({"projectId": oid})
        ors.append({"projectId": str(oid)})
    except Exception:
        pass
    return {"$or": ors}


def fetch_chunks(project_id: str, limit: int = 500) -> list[dict]:
    return list(db()["material_chunks"].find(project_filter(project_id)).limit(limit))


def _score_one(query: str, qvec: list[float], qtoks: list[str], ch: dict) -> dict:
    text = ch.get("text") or ""
    emb = ch.get("embedding") or []
    vec = cosine(qvec, [float(x) for x in emb]) if emb else 0.0
    lex = lexical_score(qtoks, text)
    lower = text.lower()
    phrase = 0.0
    for tok in qtoks:
        if len(tok) >= 4 and tok in lower:
            phrase += 0.10
    phrase = min(0.30, phrase)

    # Check if chunk tagged with this concept
    concepts = [str(c).lower() for c in (ch.get("concepts") or [])]
    concept_bonus = 0.25 if any(t in concepts for t in qtoks) else 0.0

    score = 0.45 * vec + 0.35 * lex + phrase + concept_bonus
    return {
        "score": score,
        "vec": vec,
        "lex": lex,
        "text": text,
        "pageNumber": ch.get("pageNumber", 1),
        "materialId": ch.get("materialId"),
        "materialName": ch.get("materialName") or "Uploaded document",
        "concepts": ch.get("concepts") or [],
    }


def retrieve(project_id: str, query: str, k: int = 6) -> list[dict]:
    chunks = fetch_chunks(project_id)
    if not chunks:
        return []

    overview = is_overview_question(query) or is_greeting(query) or not query.strip()
    qvec = embed_text(query or "")
    qtoks = tokenize(query or "")

    scored = [_score_one(query, qvec, qtoks, ch) for ch in chunks]
    scored.sort(key=lambda x: x["score"], reverse=True)

    if overview:
        # Give early pages and representative sections for overview
        by_page = sorted(chunks, key=lambda c: c.get("pageNumber") or 0)
        intro = []
        seen = set()
        for ch in by_page[:10]:
            key = (str(ch.get("materialId")), ch.get("pageNumber"), (ch.get("text") or "")[:40])
            if key in seen:
                continue
            seen.add(key)
            item = _score_one(query, qvec, qtoks, ch)
            item["score"] = max(item["score"], 0.60)
            item["overview"] = True
            intro.append(item)
        merged = intro + [s for s in scored if s["text"] not in {i["text"] for i in intro}]
        return merged[: max(k, 6)]

    return scored[:k]


def enough_evidence(hits: list[dict], query: str | None = None) -> bool:
    if not hits:
        return False
    if query and (is_overview_question(query) or is_greeting(query)):
        return True
    best = hits[0]
    if best.get("overview"):
        return True
    if float(best.get("score") or 0) >= 0.12:
        return True
    if float(best.get("vec") or 0) >= 0.25 or float(best.get("lex") or 0) >= 0.20:
        return True
    return False
