# Future improvements

This document tracks upcoming architectural and product enhancements, as well as recently delivered capabilities.

## Recently Delivered

- [x] **Real-time SSE Token Streaming:** Low-latency token streaming from FastAPI through Spring Boot (`text/event-stream`) to the React chat pane with live markdown and formula rendering.
- [x] **Interactive Concept Graph & 0ms Caching:** Knowledge graph extraction with fixed topology cached in MongoDB (`concept_graphs`) and explicit user-driven re-scanning.
- [x] **Smart Flashcards & Spaced Repetition:** Flashcard deck generation from concepts with SuperMemo-2 (SM-2) review interval scheduling.
- [x] **Mistakes Notebook & Root-Cause Analysis:** Automated tracking of quiz errors and AI-powered diagnostic reviews.
- [x] **Personalized Study Planner:** Automated milestone schedules based on target exam deadlines and weak concepts.
- [x] **Runtime LLM Provider Management:** Live configuration, testing, and model switching (Gemini, Groq, Ollama) directly from the Admin UI.
- [x] **Production Deployment Architecture:** Unified single-container Docker packaging for Render coupled with Vercel frontend.

## Next-Horizon Improvements

### Retrieval & Knowledge Indexing
- Replace bag-of-tokens hash embeddings with managed dense vector search (e.g. MongoDB Atlas Vector Search or Gemini text embeddings).
- Implement hybrid search (BM25 keyword matching + dense vector similarity) with cross-encoder re-ranking.
- Deep-link citation viewer: clicking a citation badge opens the PDF viewer directly scrolled and highlighted at the referenced page and bounding box.

### Tutor & Learning Experience
- Multi-document comparative analysis tool (e.g. cross-referencing conflicting textbook notes or lecture slides).
- Audio transcription and audio voice-tutor mode for auditory learners.
- Conversation summarization agent that condenses long chat threads into permanent learner memory.

### Infrastructure & Distributed Jobs
- Migrate local PDF storage to S3-compatible cloud object storage (AWS S3 or Cloudflare R2) with presigned URLs.
- Decouple background ingestion from in-process tasks to dedicated distributed workers (e.g., Redis Celery/RQ or Spring Batch queue).
- Dead-letter queue inspection and one-click job retry from the Admin dashboard.

### Collaboration & Community
- Multi-user Spaces with shared lecture materials, team concept graphs, and collaborative quiz sessions.
- Export assessment summaries and study plan milestones to PDF or Notion/Google Docs.

