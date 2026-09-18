# Known limitations

Prototype constraints for a 3–4 day candidate build. None of these are hidden; they are explicit tradeoffs.

## Retrieval and embeddings

- Embeddings are hashed bag-of-tokens, not Gemini/OpenAI embeddings or Atlas Vector Search.
- Retrieval scans **all** `material_chunks` for a project in Python and cosine-ranks in memory. Fine for a handful of PDFs; not for large corpora.
- Threshold `0.35` is a starting point; lexical overlap vs paraphrase will mis-fire in both directions.

## LLM and tutor

- No streaming (SSE). The chat waits for the full answer.
- If the model returns invalid JSON, the tutor falls back to raw text plus retrieval-derived citations.
- Heuristic mode (no API keys) produces generic quiz/tutor payloads so the UI still works.
- Conversation context sent to the model is the last few messages, not a full summarizer.

## Ingest

- Local disk (or a Docker volume), not S3 signed URLs.
- Tesseract OCR is best-effort (`tesseract` CLI). Scanned PDFs may stay sparse if OCR is missing in the image.
- Ingest uses FastAPI `BackgroundTasks` in-process, not a separate Celery worker. A process restart can drop an in-flight job; retries are in-memory recursive (max 3).
- Compose `backend` depends on `ai-service`, but ingest notify callbacks need the reverse path (`SPRING_INTERNAL_URL`). Startup race is possible on first boot.

## Product surface

- Quiz length is fixed at 5 questions.
- No WebSocket status for materials; the UI polls.
- Rate limiting is per-minute Redis counters and is skipped if Redis is down.
- `/api/internal/**` is permitAll at the filter-chain matcher; protection is the shared-secret filter only.
- Admin activity/AI-usage queries load collections then filter in memory (cap 200 activity rows).
- Global analytics are aggregations over the signed-in user’s data plus admin-wide views, not a warehouse.

## Security / ops

- Default JWT and internal secrets in `.env.example` must be changed before any public deploy.
- CORS is an allow-list of origins, not `*`, on the API; the AI service CORS is open because it is not browser-facing by design.
- No CI deploy, no production URLs in this repo yet.
- Tests do not cover full HTTP authorization matrices or live LLM calls.

## Design

- Light SaaS theme is Tailwind tokens + cards; Framer Motion is available but not used on every transition.
- Accessibility (focus traps in modals, full keyboard chat) is incomplete.
