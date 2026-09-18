import json
import logging
from app.services.llm_client import llm
from app.services.structured_output import parse_json
from app.services.retrieval import retrieve

log = logging.getLogger("ai.flashcards")

FLASHCARD_PROMPT = """You are an expert in active recall and spaced repetition learning (SuperMemo SM-2 methodology).
Generate 5-8 high-yield active-recall flashcards based on the provided learning material and concepts.

Each flashcard must have:
- conceptName: associated concept
- front: A crisp, thought-provoking question, formula completion, or scenario. Use LaTeX math ($...$) if relevant.
- back: A clear, concise answer and explanation. Keep it memorable.

MATERIAL EXCERPTS:
{material_text}

TARGET CONCEPTS:
{concepts_text}

Output strictly valid JSON:
{{
  "flashcards": [
    {{
      "conceptName": "...",
      "front": "What is the primary formula for ...?",
      "back": "..."
    }}
  ]
}}
"""

def generate_flashcards(project_id: str, concepts: list[str]) -> list[dict]:
    # Retrieve top material chunks for these concepts
    query = " ".join(concepts) if concepts else "important principles and definitions"
    hits = retrieve(project_id, query, k=5)
    material_text = "\n\n".join([f"[{h.get('materialName', 'Doc')} p.{h.get('pageNumber', 1)}]: {h.get('text', '')}" for h in hits])

    prompt = FLASHCARD_PROMPT.format(
        material_text=material_text[:4000] if material_text else "No uploaded text available.",
        concepts_text=", ".join(concepts) if concepts else "Core project concepts"
    )

    try:
        resp = llm.generate(prompt, feature="flashcard_generation", schema=True)
        data = parse_json(resp.text)
        cards = data.get("flashcards", [])
        if isinstance(cards, list) and len(cards) > 0:
            return cards
    except Exception as ex:
        log.warning("Flashcard generation failed: %s", ex)

    # Heuristic fallback flashcards from retrieved text
    cards = []
    for h in hits[:4]:
        text = (h.get("text") or "").strip()
        if len(text) > 40:
            sentences = [s.strip() for s in text.split(".") if len(s.strip()) > 20]
            if len(sentences) >= 2:
                cards.append({
                    "conceptName": concepts[0] if concepts else "Key Definition",
                    "front": f"Explain the key concept described in: '{sentences[0][:100]}...'",
                    "back": sentences[1][:200]
                })
    return cards
