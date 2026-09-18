from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.core.auth import require_internal
from app.core.config import settings
from app.services.retrieval import enough_evidence
from app.services.structured_output import EvalOut, QuizQuestionOut, RecOut, TutorOut

router = APIRouter()

GOLDEN = [
    {
        "id": "tutor-grounded",
        "kind": "tutor",
        "hits": [{"score": 0.72, "text": "Gradient descent minimizes loss.", "pageNumber": 3}],
        "expect": "grounded",
    },
    {
        "id": "tutor-unsupported",
        "kind": "tutor",
        "hits": [{"score": 0.05, "text": "unrelated", "pageNumber": 1}],
        "expect": "insufficient",
    },
]


@router.post("/eval/run")
def run_eval(_=Depends(require_internal)):
    results = []
    for case in GOLDEN:
        if case["kind"] == "tutor":
            status = "grounded" if enough_evidence(case["hits"]) else "insufficient"
            passed = status == case["expect"]
            results.append({"id": case["id"], "passed": passed, "got": status})
    schema_ok = True
    try:
        TutorOut.model_validate({"answer": "x", "citations": [], "confidence": 0.5, "evidenceStatus": "grounded"})
        QuizQuestionOut.model_validate({"type": "MCQ", "question": "q", "options": ["a", "b", "c", "d"], "correctAnswer": "a"})
        EvalOut.model_validate({"score": 0.5, "feedback": "ok"})
        RecOut.model_validate({"text": "do this", "reason": "why"})
    except Exception:
        schema_ok = False
    passed = all(r["passed"] for r in results) and schema_ok
    return {
        "ok": True,
        "passed": passed,
        "threshold": settings.retrieval_threshold,
        "results": results,
        "schemaValidation": schema_ok,
    }


class RetrievalInspectIn(BaseModel):
    query: str
    projectId: str | None = None
    model: str = "auto"


@router.post("/retrieval/inspect")
def inspect_retrieval(req: RetrievalInspectIn, _=Depends(require_internal)):
    import statistics
    from app.core.db import db
    from app.services.llm_client import embed_text, cosine

    query = req.query.strip() or "k-Nearest Neighbors classification"
    if "gemini" in req.model:
        model_name = req.model if req.model != "gemini" else "gemini-embedding-001"
    elif req.model == "auto" and settings.gemini_api_key:
        model_name = "gemini-embedding-001"
    else:
        model_name = "BAAI/bge-small-en-v1.5"
    qvec = embed_text(query, model_preference=req.model)

    query_filter = {}
    if req.projectId:
        query_filter["projectId"] = req.projectId

    db_chunks = list(db()["material_chunks"].find(query_filter).limit(100))
    scored_chunks = []
    if db_chunks:
        for ch in db_chunks:
            emb = ch.get("embedding") or []
            score = round(cosine(qvec, [float(x) for x in emb]), 3) if emb else 0.0
            scored_chunks.append({
                "id": str(ch.get("_id", "")),
                "text": (ch.get("text") or "")[:240],
                "pageNumber": ch.get("pageNumber") or 1,
                "score": score,
                "passed": score >= settings.retrieval_threshold,
            })
    else:
        benchmarks = [
            {"text": "k-Nearest Neighbors (kNN) classification logic: find k closest labeled training instances and majority vote.", "page": 14},
            {"text": "Choice of k: smaller k values increase sensitivity to noise; larger k produces smoother decision boundaries.", "page": 9},
            {"text": "Distance metrics comparison: Euclidean distance vs Manhattan distance in n-dimensional feature spaces.", "page": 16},
            {"text": "Feature normalization: feature values must be rescaled into uniform range before distance calculation.", "page": 8},
            {"text": "Dataset loading and file parsing routine classify0() implementation details.", "page": 7},
            {"text": "Relational database normalization 3NF and BCNF definitions in relational algebra.", "page": 1},
        ]
        for b in benchmarks:
            bvec = embed_text(b["text"], model_preference=req.model)
            score = round(cosine(qvec, bvec), 3)
            scored_chunks.append({
                "id": f"ref-{b['page']}",
                "text": b["text"],
                "pageNumber": b["page"],
                "score": score,
                "passed": score >= settings.retrieval_threshold,
            })

    scored_chunks.sort(key=lambda x: x["score"], reverse=True)
    top_chunks = scored_chunks[:5]
    scores = [c["score"] for c in scored_chunks]

    avg_sim = round(sum(scores) / max(len(scores), 1), 3)
    median_sim = round(statistics.median(scores), 3) if scores else 0.0
    below_cutoff = round((sum(1 for s in scores if s < settings.retrieval_threshold) / max(len(scores), 1)) * 100, 1)

    return {
        "ok": True,
        "query": query,
        "model": model_name,
        "threshold": settings.retrieval_threshold,
        "avgSimilarity": avg_sim,
        "medianSimilarity": median_sim,
        "belowCutoffPercent": below_cutoff,
        "chunks": top_chunks,
        "totalInspected": len(scored_chunks),
    }
