# Development prompts log

Organized by area. Prompts are paraphrased from the implementation plan and follow-up “continue” work in Cursor; they are not a verbatim chat dump.

## Architecture

- Split React / Spring Boot / FastAPI / Mongo / Redis with Spring owning business state and Python owning ingest + RAG + grading.
- Internal REST + shared secret; browser never calls the AI service.
- Docker Compose for local full stack; local disk for PDFs in the prototype.

## Frontend

- Vite + Tailwind light SaaS: `#FAFAFC` background, white cards, teal accent, Inter typography.
- Routes: login/register, home, spaces, space dashboard, project dashboard (materials, tutor, concept map, flashcards, quiz, mistakes, study plan, growth, analytics), global analytics, admin suite + user drill-down + runtime LLM manager.
- JWT in `AuthContext`, `ProtectedRoute` with optional `ADMIN` role, toast errors, status badges for material jobs.
- Tutor: conversation sidebar, real-time SSE token stream with LaTeX math formatting, citation chips, insufficient-evidence banner.
- Concept Map: interactive node-link graph with 0ms fast MongoDB cached load, pan/zoom canvas, difficulty and category tagging, explicit re-scan.
- Flashcards: flip-card deck with SM-2 spaced repetition (Again / Hard / Good / Easy), deck stats, and mastery progression.
- Mistakes: structured notebook of quiz misses with AI diagnostic analysis and misconception breakdown.
- Study Plan: goal milestone timeline with target completion dates and prioritized concept schedules.

## Backend

- Spring Security JWT, BCrypt users, seeded admin account.
- CRUD Spaces/Projects with ownership checks (`AccessGuard`).
- Materials upload validation (PDF MIME, 20MB limit), job tracking document, asynchronous FastAPI ingest proxy.
- Quiz state machine, weighted mastery updates, assessments, learning context, dynamic recommendations.
- SSE Emitter (`/api/tutor/stream`) proxying token streams from FastAPI to browser clients.
- Concept graph persistence (`ConceptGraphRepository`), 0ms cached graph endpoint, explicit regeneration endpoint.
- Flashcards repository and SM-2 spaced repetition algorithm handler.
- Learner mistakes tracking and analysis delegation.
- Study plan generation with quota enforcement (`QuotaService`).
- Activity events with idempotency keys.
- Admin APIs, Redis rate limiting, JSON logs + `X-Trace-Id`.
- Internal endpoints for material status, jobs, AI usage, and quota checks.

## Advanced Features & Ops

- **SSE Streaming:** FastAPI `StreamingResponse` yielding SSE tokens; Spring Boot `SseEmitter` streaming to frontend with citation metadata.
- **Runtime Provider Management:** MongoDB-backed `provider_configs` collection with live key testing and seamless switching between Gemini, Groq, and local heuristics.
- **Production Packaging:** Multi-stage `Dockerfile.production` unifying Spring Boot and FastAPI in a single lightweight Debian container managed by `start-production.sh` for low-cost Render deployment, with Vercel configuration for the React frontend.


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
