from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel, Field
from app.core.auth import require_internal
from app.workers.ingest_worker import process_material

router = APIRouter()


class IngestReq(BaseModel):
    materialId: str
    projectId: str
    filePath: str
    fileName: str | None = None
    jobId: str | None = None


@router.post("/ingest")
def ingest(req: IngestReq, background: BackgroundTasks, _=Depends(require_internal)):
    background.add_task(process_material, req.materialId, req.projectId, req.filePath, req.jobId, 0)
    return {"ok": True, "status": "QUEUED"}
