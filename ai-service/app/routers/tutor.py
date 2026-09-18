import json
import re
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.core.auth import require_internal
from app.core.config import settings
from app.core.db import db
from app.services.llm_client import llm
from app.services.prompt_templates import tutor_prompt
from app.services.retrieval import enough_evidence, retrieve
from app.services.structured_output import TutorOut, parse_json

router = APIRouter()


class AskReq(BaseModel):
    projectId: str
    question: str
    conversationId: str | None = None
    recentMessages: list[dict] = []
    learningContext: dict = {}


@router.post("/tutor/answer")
def answer(req: AskReq, _=Depends(require_internal)):
    hits = retrieve(req.projectId, req.question, k=6)
    if not hits:
        return {
            "ok": True,
            "answer": "I don't have any indexed text for this project yet. Please upload a PDF in the Materials tab and wait until it shows Ready, then ask again!",
            "citations": [],
            "confidence": 0.1,
            "evidenceStatus": "insufficient",
            "retrievalScores": [],
            "threshold": settings.retrieval_threshold,
        }

    if not enough_evidence(hits, req.question):
        return {
            "ok": True,
            "answer": "I don't find enough evidence in your uploaded PDF materials to answer that specific question. Try asking about topics, definitions, or methods covered in your notes!",
            "citations": [],
            "confidence": 0.15,
            "evidenceStatus": "insufficient",
            "retrievalScores": [h.get("score", 0) for h in hits],
            "threshold": settings.retrieval_threshold,
        }

    names = _material_names(hits)
    prompt = tutor_prompt(req.question, hits, req.recentMessages, req.learningContext)

    citations = []
    answer_text = ""
    confidence = 0.85
    evidence_status = "grounded"

    try:
        resp = llm.generate(prompt, feature="tutor", schema=True)
        parsed = TutorOut.model_validate(parse_json(resp.text))
        answer_text = parsed.answer
        citations = parsed.citations
        confidence = parsed.confidence
        evidence_status = parsed.evidenceStatus
    except Exception:
        answer_text, citations = _synthesize_answer(req.question, hits, names)
        confidence = 0.75

    # Ensure citations have source names and clean quotes
    clean_citations = []
    for c in citations:
        src = c.get("source") or names.get(str(hits[0].get("materialId")), "Uploaded Document")
        quote = (c.get("quote") or "").strip()
        page = c.get("page") or hits[0].get("pageNumber", 1)
        if quote:
            clean_citations.append({"source": src, "page": page, "quote": quote})

    if not clean_citations and hits and evidence_status == "grounded":
        for h in hits[:2]:
            t = (h.get("text") or "").strip()
            if t:
                src = h.get("materialName") or names.get(str(h.get("materialId")), "Uploaded material")
                quote = t[:140].rstrip(".")
                clean_citations.append({"source": src, "page": h.get("pageNumber", 1), "quote": quote})

    return {
        "ok": True,
        "answer": answer_text,
        "citations": clean_citations,
        "confidence": confidence,
        "evidenceStatus": evidence_status,
        "retrievalScores": [h.get("score", 0) for h in hits],
    }


@router.post("/tutor/stream")
def stream_answer(req: AskReq, _=Depends(require_internal)):
    hits = retrieve(req.projectId, req.question, k=6)
    names = _material_names(hits)

    def event_stream():
        if not hits:
            msg = "I don't have any indexed text for this project yet. Please upload a PDF in the Materials tab and wait until it shows Ready, then ask again!"
            yield f"data: {json.dumps({'chunk': msg, 'citations': [], 'evidenceStatus': 'insufficient', 'done': False})}\n\n"
            yield f"data: {json.dumps({'done': True, 'citations': [], 'evidenceStatus': 'insufficient'})}\n\n"
            return

        if not enough_evidence(hits, req.question):
            msg = "I don't find enough evidence in your uploaded PDF materials to answer that specific question. Try asking about topics, definitions, or methods covered in your notes!"
            yield f"data: {json.dumps({'chunk': msg, 'citations': [], 'evidenceStatus': 'insufficient', 'done': False})}\n\n"
            yield f"data: {json.dumps({'done': True, 'citations': [], 'evidenceStatus': 'insufficient'})}\n\n"
            return

        citations = []
        for h in hits[:2]:
            t = (h.get("text") or "").strip()
            if t:
                src = h.get("materialName") or names.get(str(h.get("materialId")), "Uploaded Document")
                quote = t[:140].rstrip(".")
                citations.append({"source": src, "page": h.get("pageNumber", 1), "quote": quote})

        stream_prompt = (
            f"You are the AI Study Companion Tutor. Answer the user's question directly in rich GitHub Markdown using LaTeX for formulas ($...$ or $$...$$).\n"
            f"Ground your answer strictly in the provided project materials.\n\n"
            f"PROJECT MATERIALS:\n" + "\n".join([f"[{h.get('materialName', 'Material')} Page {h.get('pageNumber', 1)}]: {h.get('text', '')}" for h in hits[:4]]) + "\n\n"
            f"USER QUESTION: {req.question}\n\n"
            f"Provide a clear, pedagogical explanation with formulas where helpful. Do not output JSON."
        )

        for chunk in llm.generate_stream(stream_prompt, feature="tutor_stream"):
            yield f"data: {json.dumps({'chunk': chunk, 'done': False})}\n\n"

        yield f"data: {json.dumps({'done': True, 'citations': citations, 'evidenceStatus': 'grounded'})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


def _synthesize_answer(question: str, hits: list[dict], names: dict) -> tuple[str, list[dict]]:
    sentences = []
    citations = []
    for h in hits[:3]:
        p = h.get("pageNumber", 1)
        src = h.get("materialName") or names.get(str(h.get("materialId")), "Uploaded PDF")
        t = (h.get("text") or "").strip()
        sents = [s.strip() for s in re.split(r"(?<=[.!?])\s+", t) if len(s.strip()) > 30]
        if sents:
            sentences.extend(sents[:2])
            citations.append({"source": src, "page": p, "quote": sents[0][:140]})

    if not sentences:
        return "I found relevant sections in your document, but could not synthesize a complete answer. Please review the cited pages.", []

    body = " ".join(sentences[:4])
    answer = f"Based on your uploaded notes regarding '{question}':\n\n{body}"
    return answer, citations


def _material_names(hits: list[dict]) -> dict:
    names = {}
    for h in hits:
        mid = str(h.get("materialId"))
        if mid in names:
            continue
        if h.get("materialName"):
            names[mid] = h["materialName"]
            continue
        mat = db()["materials"].find_one({"_id": _try_id(mid)}) or db()["materials"].find_one({"_id": mid})
        if mat:
            names[mid] = mat.get("fileName") or "Uploaded Material"
    return names


def _try_id(mid: str):
    try:
        from bson import ObjectId
        return ObjectId(mid)
    except Exception:
        return mid
