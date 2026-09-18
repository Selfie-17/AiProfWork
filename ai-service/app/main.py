import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import ingest, tutor, quiz, recommend, growth, eval as eval_router, providers

logging.basicConfig(level=logging.INFO, format='{"ts":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}')

app = FastAPI(title="AI Study Companion — AI Service", version="0.1.0")
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
