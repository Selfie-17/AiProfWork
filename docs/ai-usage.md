# AI usage

This document separates **build-time** AI (how the prototype was authored) from **product-time** AI (what the running system calls).

## Build-time

Cursor agents were used to scaffold the monorepo from `AI_Study_Companion_Implementation_Plan.md`: Spring Boot modules, FastAPI routers, React pages, Docker Compose, tests, and this docs set.

Build-time AI did **not** generate the uploaded study PDFs. Those are user content at runtime.

## Product-time features

| Feature | Trigger | Provider path | Structured output |
|---|---|---|---|
| Concept extract | Material ingest | Gemini → Groq → heuristic | `{concepts:[{name, description}]}` |
| Tutor answer | `/api/tutor/ask` | Same, **skipped** if retrieval is below threshold | `{answer, citations[], confidence, evidenceStatus}` |
| Quiz question | Quiz start/next | Same | `{type, question, options, correctAnswer, concept}` |
| Open-ended grade | Quiz answer when type is OPEN | Same | rubric JSON: score, understood[], missing[], feedback |
| Recommendation | Quiz complete | Same | `{text, reason}` |
| Offline eval | `POST /eval/run` (internal) | No live LLM; threshold + schema checks | pass/fail cases |

MCQ grading is local (string match) and does not call an LLM.

## Provider abstraction

`LLMClient` tries `PRIMARY_PROVIDER` (default `gemini`, model `gemini-2.0-flash`), then `FALLBACK_PROVIDER` (default `groq`, model `llama-3.1-8b-instant`), then a local `HeuristicProvider` so the loop still runs without API keys.

Embeddings are **deterministic hash vectors** (SHA-256 bag-of-tokens, dim `EMBEDDING_DIM=768`). That keeps retrieval working offline; it is not a production embedding model.

## Grounding and prompt-injection

- User questions, notes, and conversation snippets are wrapped in labeled `<data>` blocks.
- System text tells the model to treat those blocks as untrusted reference, never as instructions.
- Tutor refuses to answer when cosine(top hit) &lt; `RETRIEVAL_THRESHOLD`.
- Citations are taken from the model JSON when valid, otherwise filled from retrieved chunks (page + quote).

## Observability

Each `llm.generate(..., feature=...)` posts usage to Spring `/api/internal/ai-usage` (or writes Mongo directly). Admin UI charts usage by feature and shows estimated USD cost (rough per-token rates, not invoices).

## What AI is not used for

- Authentication, authorization, or mastery math (those are deterministic Java).
- PDF binary storage.
- Activity idempotency.
- Frontend rendering.
