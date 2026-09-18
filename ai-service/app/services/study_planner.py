import json
import logging
from app.services.llm_client import llm
from app.services.structured_output import parse_json

log = logging.getLogger("ai.study_planner")

PLAN_PROMPT = """You are an adaptive educational learning coach.
Create a personalized, step-by-step study roadmap for this student.

PROJECT GOAL: {goal}
WEAK CONCEPTS IDENTIFIED: {weak_concepts}
UPLOADED STUDY MATERIALS: {materials}

Structure the plan into 3-4 progressive milestones.
For each milestone:
- milestoneNumber: int
- title: concise title
- description: what will be accomplished
- estimatedHours: float
- focusConcepts: list of concept names
- actionableTasks: list of 3 concrete actions (e.g. read specific notes, ask Tutor, take targeted quiz)

Output strictly valid JSON:
{{
  "title": "Mastery Roadmap: ...",
  "overview": "...",
  "targetCompletionDays": 14,
  "milestones": [
    {{
      "milestoneNumber": 1,
      "title": "...",
      "description": "...",
      "estimatedHours": 3.5,
      "focusConcepts": ["..."],
      "actionableTasks": ["...", "..."]
    }}
  ]
}}
"""

def generate_study_plan(goal: str, weak_concepts: list[str], materials: list[str]) -> dict:
    prompt = PLAN_PROMPT.format(
        goal=goal or "Master course principles",
        weak_concepts=", ".join(weak_concepts) if weak_concepts else "Core fundamentals",
        materials=", ".join(materials) if materials else "Course PDF notes",
    )
    try:
        resp = llm.generate(prompt, feature="study_plan", schema=True)
        return parse_json(resp.text)
    except Exception as ex:
        log.warning("Study plan LLM generation failed: %s", ex)
        return {
            "title": f"Study Plan: {goal or 'Course Mastery'}",
            "overview": "Automated baseline plan focusing on your core course materials.",
            "targetCompletionDays": 10,
            "milestones": [
                {
                    "milestoneNumber": 1,
                    "title": "Document Review & Foundation",
                    "description": "Read through your uploaded PDF notes and identify core terminology.",
                    "estimatedHours": 2.0,
                    "focusConcepts": weak_concepts[:2] if weak_concepts else ["Foundations"],
                    "actionableTasks": ["Review uploaded PDF pages 1-5", "Ask AI Tutor 3 clarification questions", "Take initial 5-question quiz"]
                },
                {
                    "milestoneNumber": 2,
                    "title": "Targeted Drill & Remediation",
                    "description": "Focus on identified weak concepts and application scenarios.",
                    "estimatedHours": 3.0,
                    "focusConcepts": weak_concepts,
                    "actionableTasks": ["Work through sample formulas in KaTeX", "Complete adaptive quiz until score reaches 75%", "Review citations on incorrect answers"]
                }
            ]
        }
