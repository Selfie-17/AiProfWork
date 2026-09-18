from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.core.auth import require_internal
from app.core.db import db
from app.services.llm_client import llm
from app.services.prompt_templates import recommend_prompt
from app.services.structured_output import RecOut, parse_json

router = APIRouter()


class RecReq(BaseModel):
    projectId: str
    weaknesses: list[str] = []
    strengths: list[str] = []
    score: float | None = None


@router.post("/recommend/generate")
def generate(req: RecReq, _=Depends(require_internal)):
    ctx = db()["learning_context"].find_one({"projectId": req.projectId}) or {}
    payload = {
        "weaknesses": req.weaknesses or ctx.get("weaknesses") or [],
        "strengths": req.strengths or ctx.get("strengths") or [],
        "repeatedMistakes": ctx.get("repeatedMistakes") or [],
        "goals": ctx.get("goals") or "",
        "score": req.score,
    }
    try:
        resp = llm.generate(recommend_prompt(payload), feature="recommend", schema=True)
        parsed = RecOut.model_validate(parse_json(resp.text))
        return {"ok": True, **parsed.model_dump()}
    except Exception:
        weak = ", ".join(payload["weaknesses"][:3]) or "recently missed ideas"
        return {
            "ok": True,
            "text": f"Revisit {weak}, then take a short quiz focused on those concepts.",
            "reason": "Generated from current weaknesses and repeated mistakes.",
        }
