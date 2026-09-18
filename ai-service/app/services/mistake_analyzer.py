import json
import logging
from app.services.llm_client import llm
from app.services.structured_output import parse_json

log = logging.getLogger("ai.mistakes")

MISTAKE_ANALYSIS_PROMPT = """You are an expert cognitive learning analyst.
Analyze the following record of student mistakes from recent adaptive assessments.
Identify 1-3 core recurring misconception patterns (underlying reasons WHY the learner is struggling, e.g. "Confusing Manhattan with Euclidean metric invariants" or "Overfitting vs high variance intuition").

For each pattern, diagnose:
1. patternName: short title
2. conceptName: related concept
3. rootMisconception: clear explanation of the faulty intuition
4. evidence: which questions or answers triggered this pattern
5. remediationAction: precise, actionable study advice (e.g. "Review Section 2.1 formula derivations and re-take the 3-question drill")
6. severity: "HIGH" | "MEDIUM" | "LOW"

STUDENT MISTAKES:
{mistakes_json}

Output strictly valid JSON matching this schema:
{{
  "patterns": [
    {{
      "patternName": "...",
      "conceptName": "...",
      "rootMisconception": "...",
      "evidence": "...",
      "remediationAction": "...",
      "severity": "HIGH"
    }}
  ],
  "summary": "Overall synthesis of learner's recurring blind spots"
}}
"""

def analyze_repeated_mistakes(mistakes: list[dict]) -> dict:
    if not mistakes:
        return {
            "patterns": [],
            "summary": "No repeated mistake patterns detected yet. Keep quizzing to reveal learning blind spots!"
        }

    formatted = []
    for m in mistakes[:12]:
        formatted.append({
            "concept": m.get("conceptName", "General"),
            "question": m.get("questionText", "")[:180],
            "selectedAnswer": m.get("selectedAnswer", ""),
            "correctAnswer": m.get("correctAnswer", ""),
            "explanation": m.get("explanation", "")[:180],
        })

    prompt = MISTAKE_ANALYSIS_PROMPT.format(mistakes_json=json.dumps(formatted, indent=2))
    try:
        resp = llm.generate(prompt, feature="mistake_analysis", schema=True)
        parsed = parse_json(resp.text)
        return parsed
    except Exception as ex:
        log.warning("LLM mistake analysis failed, using heuristic cluster: %s", ex)
        # Heuristic fallback: group by concept
        concept_counts = {}
        for m in formatted:
            c = m.get("concept") or "General"
            concept_counts[c] = concept_counts.get(c, 0) + 1

        patterns = []
        for c, count in concept_counts.items():
            if count >= 1:
                patterns.append({
                    "patternName": f"Recurring difficulty with {c}",
                    "conceptName": c,
                    "rootMisconception": f"Multiple errors ({count}) detected when applying principles of {c}.",
                    "evidence": f"Missed {count} questions related to {c}.",
                    "remediationAction": f"Review your PDF lecture notes on {c} and ask the AI Tutor for a step-by-step example.",
                    "severity": "HIGH" if count > 1 else "MEDIUM"
                })

        return {
            "patterns": patterns,
            "summary": f"Detected recurring difficulties across {len(patterns)} concept areas."
        }
