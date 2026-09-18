from app.services.retrieval import enough_evidence, is_overview_question, lexical_score, tokenize
from app.services.structured_output import EvalOut, parse_json
from app.services.chunking import chunk_pages
from app.services.llm_client import cosine, embed_text, heuristic_complete
from app.services.prompt_templates import tutor_prompt, question_prompt


def test_insufficient_evidence_below_threshold():
    assert enough_evidence([]) is False
    assert enough_evidence([{"score": 0.1}]) is False
    assert enough_evidence([{"score": 0.9}]) is True


def test_lexical_overlap_counts_as_evidence():
    assert enough_evidence([{"score": 0.12, "lex": 0.8}]) is True


def test_overview_question_detection():
    assert is_overview_question("Summarize this PDF")
    assert not is_overview_question("What is the weather in Paris?")


def test_lexical_score_matches_shared_terms():
    q = tokenize("gradient descent minimizes loss")
    assert lexical_score(q, "Gradient descent minimizes the training loss") > 0.5
    assert lexical_score(q, "gardening watering plants soil") < 0.2


def test_eval_schema():
    parsed = EvalOut.model_validate({"score": 0.8, "understood": ["x"], "missing": [], "feedback": "good"})
    assert 0 <= parsed.score <= 1


def test_parse_json_fences():
    data = parse_json("```json\n{\"a\":1}\n```")
    assert data["a"] == 1


def test_chunking():
    pages = [{"pageNumber": 1, "text": "word " * 50}]
    chunks = chunk_pages(pages, max_chars=40)
    assert len(chunks) >= 2


def test_embeddings_are_comparable():
    a = embed_text("neural networks backpropagation")
    b = embed_text("neural networks backpropagation")
    c = embed_text("completely different gardening tips")
    assert cosine(a, b) > cosine(a, c)


def test_heuristic_tutor_uses_retrieved_material():
    prompt = tutor_prompt(
        "What is gradient descent?",
        [{"pageNumber": 3, "score": 0.8, "text": "Gradient descent minimizes loss by stepping opposite the gradient."}],
        [],
        {},
    )
    out = parse_json(heuristic_complete(prompt))
    assert "gradient" in out["answer"].lower()
    assert out.get("evidenceStatus") != "insufficient"


def test_heuristic_quiz_uses_pdf_excerpt():
    prompt = question_prompt("loss", "easy", [{"pageNumber": 1, "text": "Cross entropy is a common classification loss."}])
    prompt += "\nPreferred type: MCQ"
    out = parse_json(heuristic_complete(prompt))
    assert out["type"] == "MCQ"
    blob = (out["correctAnswer"] + " " + " ".join(out.get("options") or [])).lower()
    assert "cross entropy" in blob or "classification" in blob
