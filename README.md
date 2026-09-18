# Lumina Study — AI Study Companion

Monorepo for the candidate-challenge prototype: React frontend, Spring Boot API, Python FastAPI AI service, MongoDB, Redis.

## Architecture

React (JWT) → Spring Boot (auth, spaces, projects, quiz/mastery state, admin) → FastAPI (ingest, RAG tutor, quiz generation/grading, recommendations) → Gemini (primary) / Groq (fallback) / local heuristic if no keys.

See `docs/architecture.md`.

## Local development

### 1. Infrastructure

```bash
docker compose up mongo redis
```

Or run MongoDB and Redis locally on default ports.

### 2. Environment

Copy `.env.example` to `.env` and set `GEMINI_API_KEY` / `GROQ_API_KEY` if you have them. The AI service still runs without keys using a heuristic provider.

### 3. Backend (Spring Boot, port 8080)

Requires JDK 17 and Maven.

```bash
cd backend
mvn spring-boot:run
```

Seeded admin: `admin@studycompanion.local` / `Admin123!`

### 4. AI service (FastAPI, port 8000)

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 5. Frontend (Vite, port 5173)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Docker (all services)

```bash
docker compose up --build
```

Frontend: http://localhost:5173 · API: http://localhost:8080 · AI: http://localhost:8000

## Tests

```bash
cd backend && mvn test
cd ai-service && pytest
cd frontend && npm test
```

GitHub Actions (`.github/workflows/ci.yml`) runs the same three jobs on push/PR. Frontend CI uses `npm install` because a lockfile may not be committed yet.

## Core learning loop

Register → Space → Project → upload PDF → wait until Ready → Tutor (grounded citations / insufficient evidence) → Quiz → Growth & recommendations → Analytics → Admin.

## Docs

- `docs/architecture.md`
- `docs/ai-usage.md`
- `docs/evaluation.md`
- `docs/known-limitations.md`
- `docs/future-improvements.md`
- `docs/dev-prompts-log.md`
