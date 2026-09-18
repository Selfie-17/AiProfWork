from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.core.auth import require_internal
from app.services.mistake_analyzer import analyze_repeated_mistakes
from app.services.concept_mapper import generate_concept_graph
from app.services.study_planner import generate_study_plan

router = APIRouter()


class GrowthReq(BaseModel):
    projectId: str
    concepts: list[dict] = []


class MistakeReq(BaseModel):
    projectId: str
    mistakes: list[dict] = []


class ConceptGraphReq(BaseModel):
    projectId: str
    concepts: list[dict] = []


class StudyPlanReq(BaseModel):
    projectId: str
    goal: str = ""
    weakConcepts: list[str] = []
    materials: list[str] = []


@router.post("/growth/analyze")
def analyze(req: GrowthReq, _=Depends(require_internal)):
    summary = []
    for c in req.concepts:
        score = float(c.get("masteryScore") or 0)
        trend = c.get("trend") or "STABLE"
        if score < 45:
            trend = "ATTENTION"
        summary.append({
            "name": c.get("name"),
            "masteryScore": score,
            "trend": trend,
            "note": "Needs review" if trend == "ATTENTION" else ("Nice progress" if trend == "IMPROVING" else "Holding steady"),
        })
    return {"ok": True, "concepts": summary}


@router.post("/growth/analyze-mistakes")
def analyze_mistakes(req: MistakeReq, _=Depends(require_internal)):
    result = analyze_repeated_mistakes(req.mistakes)
    return {"ok": True, "data": result}


@router.post("/growth/concept-graph")
def concept_graph(req: ConceptGraphReq, _=Depends(require_internal)):
    graph = generate_concept_graph(req.concepts, project_id=req.projectId)
    return {"ok": True, "data": graph}


@router.post("/growth/study-plan")
def study_plan(req: StudyPlanReq, _=Depends(require_internal)):
    plan = generate_study_plan(req.goal, req.weakConcepts, req.materials)
    return {"ok": True, "data": plan}
