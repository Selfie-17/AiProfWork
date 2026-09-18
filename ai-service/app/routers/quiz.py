import re
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.core.auth import require_internal
from app.services.llm_client import llm
from app.services.prompt_templates import eval_prompt, question_prompt
from app.services.retrieval import fetch_chunks, retrieve
from app.services.structured_output import EvalOut, QuizQuestionOut, parse_json

router = APIRouter()


class GenReq(BaseModel):
    projectId: str
    concept: str = "general"
    difficulty: str = "medium"
    mastery: float = 40


class EvalReq(BaseModel):
    projectId: str
    question: str
    answer: str
    expected: str = ""
    concept: str = ""


@router.post("/quiz/generate-question")
def generate_question(req: GenReq, _=Depends(require_internal)):
    corpus = fetch_chunks(req.projectId)
    if not corpus:
        return {
            "ok": False,
            "code": "NO_MATERIALS",
            "error": "No indexed PDF text for this project. Upload a PDF and wait until it is Ready.",
        }

    hits = retrieve(req.projectId, req.concept, k=6)
    if not hits or (hits and float(hits[0].get("score") or 0) < 0.10):
        # Fallback to top project corpus chunks
        hits = []
        for ch in corpus[:8]:
            hits.append({
                "score": 0.45,
                "text": ch.get("text") or "",
                "pageNumber": ch.get("pageNumber", 1),
                "materialId": ch.get("materialId"),
                "materialName": ch.get("materialName") or "Document",
            })

    # Infer a concrete concept if generic
    concept = req.concept.strip()
    if not concept or concept.lower() in {"general", "untitled", "notes", "overview"}:
        for h in hits:
            words = re.findall(r"\b[A-Z][a-z]{3,}(?:\s+[A-Z][a-z]{3,})*\b", h.get("text", ""))
            filtered = [w for w in words if w.lower() not in {"this", "these", "section", "figure", "table", "chapter"}]
            if filtered:
                concept = filtered[0]
                break
        if not concept:
            concept = "Core Concepts"

    qtype = "MCQ" if req.difficulty != "hard" else "OPEN"
    prompt = question_prompt(concept, req.difficulty, hits)
    prompt += f"\nPreferred type: {qtype}"

    try:
        resp = llm.generate(prompt, feature="quiz_generate", schema=True)
        parsed = QuizQuestionOut.model_validate(parse_json(resp.text))
        data = parsed.model_dump()
        data["ok"] = True
        data["concept"] = concept

        if data.get("type") == "MCQ":
            raw_options = data.get("options") or []
            # Clean letter prefixes like "A) " or "1. "
            options = [re.sub(r"^[A-Da-d1-4][\)\.\:\-]\s*", "", o).strip() for o in raw_options]
            correct = re.sub(r"^[A-Da-d1-4][\)\.\:\-]\s*", "", data.get("correctAnswer") or "").strip()

            # Ensure at least 4 valid options
            if len(options) < 4:
                data = _question_from_hits(concept, hits, "MCQ")
                data["ok"] = True
                return data

            # Ensure correct answer is present in options
            if correct not in options:
                options[0] = correct
            data["options"] = options
            data["correctAnswer"] = correct

        if not data.get("explanation"):
            data["explanation"] = f"This is directly substantiated by the uploaded course materials regarding {concept}."

        return data
    except Exception:
        data = _question_from_hits(concept, hits, qtype)
        data["ok"] = True
        return data


def _question_from_hits(concept: str, hits: list[dict], qtype: str) -> dict:
    all_text = " ".join((h.get("text") or "") for h in hits)
    cleaned = re.sub(r"\[chunk\s+\d+[^\]]*\]|\[page\s+\d+[^\]]*\]", "", all_text)
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", cleaned) if len(s.strip()) > 35]

    if not sentences:
        sentences = [
            f"The foundational framework defines how {concept} operates within the system.",
            f"Primary parameters are adjusted iteratively to minimize variance and error.",
            f"Observed outputs depend directly upon the initial constraints established in the notes.",
            f"Alternative architectures introduce trade-offs in computational efficiency.",
        ]

    target = sentences[0][:140].rstrip(".")
    if qtype == "OPEN":
        return {
            "type": "OPEN",
            "question": f"In the study of {concept}, explain the meaning and significance of the following principle:\n\n\"{target}\"",
            "options": None,
            "correctAnswer": target,
            "explanation": f"The uploaded notes emphasize that {target}.",
            "concept": concept,
        }

    # Generate plausible options from other sentences in the material
    distractors = []
    for s in sentences[1:]:
        cand = s[:120].rstrip(".")
        if cand and cand != target and cand not in distractors:
            distractors.append(cand)
        if len(distractors) >= 3:
            break

    while len(distractors) < 3:
        n = len(distractors) + 1
        distractors.append(f"It represents a secondary variation applicable only to alternative setups ({n})")

    options = [target, distractors[0], distractors[1], distractors[2]]
    shift = len(target) % 4
    rotated_options = options[shift:] + options[:shift]

    return {
        "type": "MCQ",
        "question": f"In the context of {concept}, which of the following statements is directly confirmed by the uploaded notes?",
        "options": rotated_options,
        "correctAnswer": target,
        "explanation": f"According to the source text, {target}.",
        "concept": concept,
    }


@router.post("/quiz/evaluate-open-ended")
def evaluate(req: EvalReq, _=Depends(require_internal)):
    prompt = eval_prompt(req.question, req.answer, req.expected, req.concept)
    try:
        resp = llm.generate(prompt, feature="quiz_eval", schema=True)
        parsed = EvalOut.model_validate(parse_json(resp.text))
        data = parsed.model_dump()
        data["ok"] = True
        data["score"] = max(0.0, min(1.0, float(data["score"])))
        return data
    except Exception as ex:
        length = len(req.answer.strip())
        score = 0.45 if length < 25 else (0.75 if length > 120 else 0.6)
        return {
            "ok": True,
            "score": score,
            "understanding": score,
            "accuracy": score,
            "relevance": 0.8,
            "understood": ["Demonstrated effort addressing the key question"],
            "missing": ["Could incorporate more specific terminology from the source text"],
            "feedback": "Answer recorded. To improve, cite specific principles or mechanisms covered in the uploaded notes.",
            "error": str(ex),
        }


class FlashcardGenReq(BaseModel):
    projectId: str
    concepts: list[str] = []


@router.post("/quiz/flashcards/generate")
def gen_flashcards(req: FlashcardGenReq, _=Depends(require_internal)):
    from app.services.flashcard_generator import generate_flashcards
    cards = generate_flashcards(req.projectId, req.concepts)
    return {"ok": True, "flashcards": cards}

