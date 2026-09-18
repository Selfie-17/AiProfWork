# Development prompts log

Organized by area. Prompts are paraphrased from the implementation plan and follow-up “continue” work in Cursor; they are not a verbatim chat dump.

## Architecture

- Split React / Spring Boot / FastAPI / Mongo / Redis with Spring owning business state and Python owning ingest + RAG + grading.
- Internal REST + shared secret; browser never calls the AI service.
- Docker Compose for local full stack; local disk for PDFs in the prototype.

## Frontend

- Vite + Tailwind light SaaS: `#FAFAFC` background, white cards, teal accent, Inter.
- Routes: login/register, home, spaces, space dashboard, project dashboard + materials/tutor/quiz/growth/analytics, global analytics, admin + user drill-down.
- JWT in `AuthContext`, `ProtectedRoute` with optional `ADMIN` role, toast errors, status badges for material jobs.
- Tutor: conversation sidebar, citation chips, insufficient-evidence banner (no streaming).

## Backend

- Spring Security JWT, BCrypt users, seed admin.
- CRUD Spaces/Projects with ownership checks (`AccessGuard`).
- Materials upload validation (PDF, 20MB), job document, proxy ingest.
- Quiz state machine, weighted mastery, assessments, learning context, recommendations.
- Activity events with idempotency keys.
- Admin APIs, rate limit via Redis, JSON logs + `X-Trace-Id`.
- Internal endpoints for material status, jobs, AI usage.

## Database

- Collections as in the implementation plan: users, spaces, projects, materials, material_chunks, concepts, conversations, messages, quizzes, quiz_questions, assessments, mastery_history, recommendations, learning_context, activity_events, ai_usage_logs, jobs.
- Project-scoped queries; unique-ish activity idempotency on write.

## AI

- Provider protocol: Gemini primary, Groq fallback, heuristic last.
- `<data>` wrapping + insufficient-evidence branch before LLM.
- Hash embeddings + cosine retrieval scoped by `projectId`.
- Pydantic structured outputs; usage logging to Spring or Mongo.
- Ingest: PyMuPDF + optional Tesseract, chunk, embed, extract concepts, retry 3×.

## Debugging / ops

- Shared `uploads` volume so FastAPI can read files Spring wrote.
- Rate limiter fails open if Redis is down.
- Heuristic provider so missing `GEMINI_API_KEY` does not block the demo loop.

## Testing

- JUnit mastery weighting + password hashing.
- Pytest retrieval threshold, JSON parse, chunking, embedding similarity.
- Vitest smoke for login + status badge.
- `/eval/run` golden grounded vs unsupported tutor cases.

## Docs

- After the app skeleton existed, write architecture, AI usage, evaluation, limitations, future work, and this log so README links resolve.
