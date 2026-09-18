import logging
import os
import re
import tempfile
import time
from datetime import datetime, timezone

import httpx
from app.core.config import settings
from app.core.db import db
from app.services.cache_service import cache_service
from app.services.chunking import chunk_pages
from app.services.llm_client import embed_text, embed_texts, llm
from app.services.ocr import extract_pages
from app.services.prompt_templates import concept_prompt
from app.services.structured_output import parse_json

log = logging.getLogger("ai.ingest")


def _id_filter(field: str, value: str) -> dict:
    ors = [{field: str(value)}, {field: value}]
    try:
        from bson import ObjectId
        ors.append({field: ObjectId(value)})
    except Exception:
        pass
    return {"$or": ors}


def _notify_spring(path: str, payload: dict):
    try:
        httpx.post(
            f"{settings.spring_internal_url}{path}",
            headers={"X-Internal-Secret": settings.internal_service_secret},
            json=payload,
            timeout=10,
        )
    except Exception as ex:
        log.warning("spring notify failed %s %s", path, ex)


def _set_material(material_id: str, **fields):
    from bson import ObjectId
    q = {"_id": material_id}
    try:
        q = {"$or": [{"_id": material_id}, {"_id": ObjectId(material_id)}]}
    except Exception:
        q = {"_id": material_id}
    db()["materials"].update_one(q, {"$set": fields})
    _notify_spring(f"/api/internal/materials/{material_id}/status", fields)


def process_material(material_id: str, project_id: str, file_path: str, job_id: str | None = None, retries: int = 0):
    try:
        if retries:
            time.sleep(min(8, 2 ** retries))
        _set_material(material_id, status="PROCESSING")
        if job_id:
            _notify_spring(f"/api/internal/jobs/{job_id}", {"status": "RUNNING", "retryCount": retries})

        actual_path = file_path
        if not os.path.exists(file_path):
            log.info("File path %s not found locally; fetching from Spring Boot internal endpoint", file_path)
            temp_dir = os.path.join(tempfile.gettempdir(), "studycompanion_materials")
            os.makedirs(temp_dir, exist_ok=True)
            temp_file = os.path.join(temp_dir, f"{material_id}.pdf")
            try:
                resp = httpx.get(
                    f"{settings.spring_internal_url}/api/internal/materials/{material_id}/file",
                    headers={"X-Internal-Secret": settings.internal_service_secret},
                    timeout=30,
                )
                if resp.status_code == 200:
                    with open(temp_file, "wb") as f:
                        f.write(resp.content)
                    actual_path = temp_file
                else:
                    log.warning("Could not download file from Spring: HTTP %s", resp.status_code)
            except Exception as ex:
                log.warning("Error downloading file from Spring: %s", ex)

        pages = extract_pages(actual_path)
        chunks = chunk_pages(pages)

        # Get original file name for rich citation metadata
        from bson import ObjectId
        mat_doc = db()["materials"].find_one({"_id": material_id})
        if not mat_doc:
            try:
                mat_doc = db()["materials"].find_one({"_id": ObjectId(material_id)})
            except Exception:
                mat_doc = None
        file_name = (mat_doc.get("fileName") if mat_doc else None) or "Uploaded Document"

        # Build representative sample across document
        sample_chunks = []
        step = max(1, len(chunks) // 6)
        for i in range(0, min(len(chunks), step * 6), step):
            sample_chunks.append(chunks[i]["text"])
        sample = "\n\n".join(sample_chunks)[:5000]

        # Fast local concept extraction (0 external API calls, 0 latency, 0 rate limits)
        all_words = re.findall(r"\b[A-Z][a-zA-Z]{3,}\b", sample)
        counts = {}
        stop_words = {"this", "that", "from", "with", "page", "chunk", "figure", "table", "section", "chapter", "document", "university", "introduction", "conclusion", "abstract", "summary"}
        for w in all_words:
            if w.lower() not in stop_words:
                counts[w] = counts.get(w, 0) + 1
        sorted_terms = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:6]
        if sorted_terms:
            concepts = [{"name": term, "description": f"Key concept '{term}' from {file_name}"} for term, _ in sorted_terms]
        else:
            concepts = [{"name": "Core Principles", "description": f"Main principles and findings from {file_name}"}]

        now = datetime.now(timezone.utc)
        col_concepts = db()["concepts"]
        for c in concepts:
            name = (c.get("name") or "Untitled").strip()
            existing = col_concepts.find_one({"projectId": str(project_id), "name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}})
            if not existing:
                col_concepts.insert_one({
                    "projectId": str(project_id),
                    "name": name,
                    "description": c.get("description") or f"Concept from {file_name}",
                    "masteryScore": 40,
                    "trend": "STABLE",
                    "lastUpdated": now,
                })

        db()["material_chunks"].delete_many(_id_filter("materialId", material_id))
        docs = []
        names = [c.get("name") for c in concepts if c.get("name")]

        # Fast batch embedding via BAAI model
        chunk_texts = [ch["text"] for ch in chunks]
        embeddings = embed_texts(chunk_texts)

        for ch, emb in zip(chunks, embeddings):
            docs.append({
                "materialId": str(material_id),
                "materialName": file_name,
                "projectId": str(project_id),
                "pageNumber": ch["pageNumber"],
                "text": ch["text"],
                "embedding": emb,
                "concepts": names,
            })
        if docs:
            db()["material_chunks"].insert_many(docs)

        # Invalidate project corpus cache so subsequent retrieval immediately sees new materials
        cache_service.invalidate_project(str(project_id))

        _set_material(material_id, status="READY", pageCount=len(pages), error=None)
        if job_id:
            _notify_spring(f"/api/internal/jobs/{job_id}", {"status": "DONE", "retryCount": retries})
        return {"ok": True, "chunks": len(docs), "pages": len(pages)}
    except Exception as ex:
        log.exception("process_material failed")
        if retries < 3:
            return process_material(material_id, project_id, file_path, job_id, retries + 1)
        _set_material(material_id, status="FAILED", error=str(ex))
        if job_id:
            _notify_spring(f"/api/internal/jobs/{job_id}", {"status": "FAILED", "error": str(ex), "retryCount": retries})
        return {"ok": False, "error": str(ex)}
