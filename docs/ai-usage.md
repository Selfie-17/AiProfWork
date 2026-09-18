# AI usage

This document separates **build-time** AI (how the prototype was authored) from **product-time** AI (what the running system calls).

## Build-time

Cursor agents were used to scaffold the monorepo from `AI_Study_Companion_Implementation_Plan.md`: Spring Boot modules, FastAPI routers, React pages, Docker Compose, tests, and this docs set.

Build-time AI did **not** generate the uploaded study PDFs. Those are user content at runtime.

## Product-time features

| Feature | Trigger | Provider path | Structured output |
|---|---|---|---|
| **Concept extraction** | Material ingest | Gemini → Groq → heuristic | `{concepts: [{name, description, difficulty, category}]}` |
| **Concept Graph & Topology** | Concept Map tab / rescan | Gemini → Groq → heuristic | `{nodes: [...], edges: [...], categories: [...]}` |
| **Tutor Answer (REST & SSE Stream)** | Tutor chat message | Gemini → Groq → heuristic (skipped if retrieval < threshold) | Real-time SSE token stream + citation badges `{source, page, quote}` |
| **Quiz Generation** | Quiz start / next question | Gemini → Groq → heuristic | `{type: "MCQ"|"OPEN", question, options, correctAnswer, concept}` |
| **Open-ended Grading** | Quiz submission (OPEN) | Gemini → Groq → heuristic | Rubric JSON: `{score, understood[], missing[], feedback}` |
| **Flashcard Deck Generation** | Flashcards generate | Gemini → Groq → heuristic | `[{front, back, conceptName, difficulty}]` |
| **Mistakes Root-Cause Analysis** | Mistakes Notebook analyze | Gemini → Groq → heuristic | `{misconceptions: [...], studyAdvice: [...]}` |
| **Study Plan Generation** | Study Plan generate | Gemini → Groq → heuristic | `{milestones: [...], weeklyHours, targetScore}` |
| **Recommendations** | Quiz completion | Gemini → Groq → heuristic | `{text, reason}` |
| **Offline Eval** | `POST /eval/run` (internal) | No live LLM; threshold & schema regression checks | Pass / fail test suites |

MCQ grading is local (deterministic string match) and does not consume LLM tokens.

## Provider abstraction & Runtime Management

- `LLMClient` tries `PRIMARY_PROVIDER` (default `gemini`, model `gemini-2.0-flash`), then `FALLBACK_PROVIDER` (default `groq`, model `llama-3.1-8b-instant`), and finally a local `HeuristicProvider` so every capability runs seamlessly even without external API keys.
- **Runtime Provider Configuration:** Administrators can dynamically update provider settings, test API keys, and swap primary/fallback models at runtime directly through the Admin UI without restarting server instances. Configurations are persisted in the `provider_configs` MongoDB collection.
- **Deterministic Embeddings:** Chunks and queries utilize deterministic hash vectors (SHA-256 bag-of-tokens with dim `EMBEDDING_DIM=768`) to guarantee fast, zero-cost, fully offline retrieval.

## Grounding and prompt-injection defense

- User prompts, conversation snippets, and document contents are strictly wrapped in designated `<data>` containers.
- System instructions enforce that data containers are treated exclusively as untrusted reference materials.
- Tutor refuses to formulate speculative answers when top cosine match score < `RETRIEVAL_THRESHOLD`.
- Citations are extracted and verified against indexed project materials with explicit source file names and page indices.

## Observability

Every `llm.generate(..., feature=...)` and streaming completion logs execution metrics (`{feature, model, provider, tokens, latencyMs, costEstimate, status}`) to `ai_usage_logs`. The Admin UI visualizes breakdowns by feature, token consumption, and estimated dollar costs.

## What AI is not used for

- User authentication, JWT issuance, or password hashing (BCrypt).
- Core authorization or project data isolation (`AccessGuard`).
- Mathematical mastery calculations and SM-2 spaced repetition decay algorithms (deterministic Java logic).
- PDF binary storage and file system management.
- Activity idempotency deduplication.
