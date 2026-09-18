# Future improvements

Ordered by impact on the PRD “context never lost” loop, not by novelty.

## Retrieval

- Replace hash embeddings with a real embedding API or Atlas Vector Search index on `material_chunks.embedding`.
- Hybrid search (BM25 + vector) and a cross-encoder rerank on the top 20.
- Per-material citation deep-link: open the PDF at the cited page in the UI.

## Tutor

- SSE or token streaming from FastAPI through Spring Boot to the chat pane.
- Conversation summarizer into `learning_context` so long chats stay cheap.
- Explicit “compare two uploaded sources” tool that still refuses when evidence is thin.

## Jobs and storage

- Dedicated worker process (RQ/Celery or Spring `@Async` queue) with job lease/heartbeat so ingest survives restarts.
- S3-compatible object storage and short-lived download URLs.
- Dead-letter UI on Admin for failed jobs with one-click retry.

## Quiz / mastery

- Item-response style difficulty instead of three buckets.
- Spaced-repetition / flashcards generated from `ATTENTION` concepts (nice-to-have in the plan).
- Calibrate open-ended grading against a small human-labeled set.

## Evaluation and ops

- Nightly eval: golden questions over a fixture PDF, store results in Mongo, chart pass rate on Admin.
- Trace IDs propagated into Python logs (currently Spring-side MDC).
- GitHub Actions already intended for unit tests; add deploy-on-main once hosts exist.

## Product

- Mobile layout pass and empty-state illustrations.
- Multi-member Spaces with roles (today a space is owned by one user).
- Export assessment PDF for a project.
