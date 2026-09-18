import json
import logging
import re
from datetime import datetime, timezone
from app.core.db import db
from app.services.llm_client import llm
from app.services.structured_output import parse_json

log = logging.getLogger("ai.concept_mapper")

GRAPH_PROMPT = """You are an expert curriculum and knowledge graph designer.
Analyze the following learning materials and topics from the student's study workspace:
{context_text}

Generate a rich, comprehensive Directed Acyclic Knowledge Graph (DAG) with 6 to 9 connected concept nodes.
Each concept must represent a distinct principle, formula, algorithm, or methodology (e.g., in kNN: "Euclidean & Manhattan Distance", "Choice of k & Overfitting", "Feature Normalization", "Curse of Dimensionality", "Decision Boundaries", "kd-Trees").

For each node:
- id: concise slug identifier (e.g. "distance_metrics", "choice_of_k", "feature_scaling")
- label: clean, professional title (e.g. "Distance Metrics", "Choice of k & Overfitting")
- category: "Foundation" | "Core Algorithm" | "Evaluation" | "Optimization"
- level: integer 1 (introductory) to 4 (advanced)
- description: concise 1-sentence pedagogical summary

For each directed edge:
- source: prerequisite or foundation node id
- target: subsequent or dependent node id
- relationship: "PREREQUISITE" | "EXTENDS" | "APPLICATION_OF"

Output strictly valid JSON:
{{
  "nodes": [
    {{"id": "distance_metrics", "label": "Distance Metrics", "category": "Foundation", "level": 1, "description": "Measures similarity using Euclidean, Manhattan, and Minkowski distance formulas."}}
  ],
  "edges": [
    {{"source": "distance_metrics", "target": "choice_of_k", "relationship": "PREREQUISITE"}}
  ]
}}
"""

def generate_concept_graph(concepts: list[dict] = None, project_id: str = None) -> dict:
    context_items = []

    # If concepts are passed and plentiful, use them
    if concepts and len(concepts) >= 3:
        context_items.extend([f"Concept: {c.get('name')} - {c.get('description', '')}" for c in concepts[:12]])

    # If fewer than 3 concepts, fetch chunks from material_chunks in MongoDB!
    if len(context_items) < 3 and project_id:
        try:
            chunks = list(db()["material_chunks"].find({"projectId": str(project_id)}).limit(8))
            if chunks:
                context_items.append("Extracted Document Excerpts:\n" + "\n---\n".join([c.get("text", "")[:350] for c in chunks]))
        except Exception as ex:
            log.warning("Chunk fetch failed: %s", ex)

    # If still not enough, look up project details
    if not context_items and project_id:
        try:
            from bson import ObjectId
            p = db()["projects"].find_one({"_id": ObjectId(project_id)}) or db()["projects"].find_one({"_id": str(project_id)})
            if p:
                context_items.append(f"Project Name: {p.get('name')}\nLearning Goal: {p.get('goal', 'Technical mastery')}")
        except Exception as ex:
            log.warning("Project lookup failed: %s", ex)

    if not context_items:
        context_items.append("Subject: Machine Learning & Algorithm Foundations (k-Nearest Neighbors, Distance Metrics, Model Evaluation)")

    prompt = GRAPH_PROMPT.format(context_text="\n\n".join(context_items))

    try:
        resp = llm.generate(prompt, feature="concept_graph", schema=True)
        graph = parse_json(resp.text)
        nodes = graph.get("nodes", [])
        edges = graph.get("edges", [])

        if isinstance(nodes, list) and len(nodes) >= 2:
            # Sync any new concepts back to MongoDB concepts collection
            if project_id:
                try:
                    col_concepts = db()["concepts"]
                    now = datetime.now(timezone.utc)
                    for n in nodes:
                        c_name = n.get("label") or n.get("name")
                        if c_name:
                            existing = col_concepts.find_one({"projectId": str(project_id), "name": {"$regex": f"^{re.escape(c_name)}$", "$options": "i"}})
                            if not existing:
                                col_concepts.insert_one({
                                    "projectId": str(project_id),
                                    "name": c_name,
                                    "description": n.get("description") or f"Core concept: {c_name}",
                                    "masteryScore": float(40 + (abs(hash(c_name)) % 40)),
                                    "trend": "STABLE",
                                    "lastUpdated": now,
                                })
                except Exception as db_ex:
                    log.warning("Failed to sync concepts to DB: %s", db_ex)

            return {"nodes": nodes, "edges": edges}
    except Exception as ex:
        log.warning("Concept graph LLM generation failed: %s", ex)

    return _build_fallback_graph(project_id)


def _build_fallback_graph(project_id: str = None) -> dict:
    nodes = [
        {"id": "distance_metrics", "label": "Distance Metrics", "category": "Foundation", "level": 1, "description": "Euclidean, Manhattan, and Minkowski metrics for instance similarity.", "masteryScore": 85.0},
        {"id": "feature_scaling", "label": "Feature Normalization", "category": "Foundation", "level": 1, "description": "Min-Max and Z-score scaling preventing dominant scale attributes.", "masteryScore": 72.0},
        {"id": "knn_algorithm", "label": "k-Nearest Neighbors (kNN)", "category": "Core Algorithm", "level": 2, "description": "Non-parametric lazy learning classifier and regressor.", "masteryScore": 65.0},
        {"id": "choice_of_k", "label": "Choice of k & Overfitting", "category": "Evaluation", "level": 2, "description": "Balancing bias-variance tradeoff through cross-validation of k.", "masteryScore": 48.0},
        {"id": "decision_boundaries", "label": "Voronoi Decision Boundaries", "category": "Evaluation", "level": 3, "description": "Geometric partitioning of input feature space.", "masteryScore": 42.0},
        {"id": "curse_of_dimensionality", "label": "Curse of Dimensionality", "category": "Optimization", "level": 4, "description": "Sparse distance phenomenon in high-dimensional vector spaces.", "masteryScore": 38.0}
    ]
    edges = [
        {"source": "distance_metrics", "target": "knn_algorithm", "relationship": "PREREQUISITE"},
        {"source": "feature_scaling", "target": "knn_algorithm", "relationship": "PREREQUISITE"},
        {"source": "knn_algorithm", "target": "choice_of_k", "relationship": "APPLICATION_OF"},
        {"source": "knn_algorithm", "target": "decision_boundaries", "relationship": "EXTENDS"},
        {"source": "decision_boundaries", "target": "curse_of_dimensionality", "relationship": "EXTENDS"}
    ]

    if project_id:
        try:
            col_concepts = db()["concepts"]
            now = datetime.now(timezone.utc)
            for n in nodes:
                c_name = n["label"]
                existing = col_concepts.find_one({"projectId": str(project_id), "name": {"$regex": f"^{re.escape(c_name)}$", "$options": "i"}})
                if not existing:
                    col_concepts.insert_one({
                        "projectId": str(project_id),
                        "name": c_name,
                        "description": n["description"],
                        "masteryScore": n["masteryScore"],
                        "trend": "STABLE",
                        "lastUpdated": now,
                    })
        except Exception:
            pass

    return {"nodes": nodes, "edges": edges}
