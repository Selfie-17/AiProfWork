import logging
import uuid
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.core.context import correlation_id_var
from app.routers import ingest, tutor, quiz, recommend, growth, eval as eval_router, providers

logging.basicConfig(level=logging.INFO, format='{"ts":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}')

app = FastAPI(title="AI Study Companion — AI Service", version="0.1.0")

@app.middleware("http")
async def correlation_id_middleware(request: Request, call_next):
    cid = (
        request.headers.get("x-correlation-id")
        or request.headers.get("x-trace-id")
        or request.headers.get("x-request-id")
        or f"req_{uuid.uuid4().hex[:12]}"
    ).strip()
    token = correlation_id_var.set(cid)
    try:
        response = await call_next(request)
        response.headers["X-Correlation-ID"] = cid
        return response
    finally:
        correlation_id_var.reset(token)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router)
app.include_router(tutor.router)
app.include_router(quiz.router)
app.include_router(recommend.router)
app.include_router(growth.router)
app.include_router(eval_router.router)
app.include_router(providers.router, prefix="/providers")


@app.get("/health")
def health():
    return {"ok": True, "service": "ai-service"}
