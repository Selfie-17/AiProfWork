from pydantic import BaseModel, Field, ValidationError
import json


class TutorOut(BaseModel):
    answer: str
    citations: list[dict] = Field(default_factory=list)
    confidence: float = 0.5
    evidenceStatus: str = "grounded"


class QuizQuestionOut(BaseModel):
    type: str
    question: str
    options: list[str] | None = None
    correctAnswer: str | None = None
    explanation: str | None = None
    concept: str | None = None



class EvalOut(BaseModel):
    score: float
    understanding: float | None = None
    accuracy: float | None = None
    relevance: float | None = None
    understood: list[str] = Field(default_factory=list)
    missing: list[str] = Field(default_factory=list)
    feedback: str = ""


class RecOut(BaseModel):
    text: str
    reason: str = ""


def parse_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start >= 0 and end > start:
            return json.loads(text[start : end + 1])
        raise


def validate(model, text: str):
    data = parse_json(text) if isinstance(text, str) else text
    try:
        return model.model_validate(data)
    except ValidationError:
        raise
