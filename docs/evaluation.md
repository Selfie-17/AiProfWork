# Evaluation approach

The prototype uses three layers: unit tests, an offline AI harness, and a manual learning-loop checklist.

## Automated tests

**Backend (JUnit)** — `backend/src/test/java/com/studycompanion/MasteryLogicTest.java`

- Passwords are BCrypt, not plaintext.
- Mastery update is a weighted blend (not “wrong → easy / correct → hard” only). Hard correct answers raise score; easy misses lower it without collapsing to 0.

**AI service (Pytest)** — `ai-service/tests/test_ai.py`

- `enough_evidence` is false for empty/low scores and true above threshold.
- Open-ended eval schema accepts scores in `[0, 1]`.
- JSON fence stripping (`parse_json`).
- Chunker splits long pages.
- Same-text embeddings cosine-match more than unrelated text.

**Frontend (Vitest + RTL)** — `frontend/src/App.test.jsx`

- Status badge renders processing states.
- Login screen mounts inside auth/toast providers.

Run:

```bash
cd backend && mvn test
cd ai-service && pytest
cd frontend && npm test
```

## Offline harness

`POST /eval/run` on the AI service (internal secret) walks a tiny golden set:

| Case | Retrieval scores | Expected |
|---|---|---|
| `tutor-grounded` | 0.72 | `grounded` |
| `tutor-unsupported` | 0.05 | `insufficient` |

It also instantiates Pydantic models (`TutorOut`, `QuizQuestionOut`, `EvalOut`, `RecOut`) to catch schema drift.

This is a **regression gate for policy**, not a full LLM quality bench. It does not score citation faithfulness of live Gemini/Groq answers.

## Manual QA (submission loop)

As a student:

1. Register → create Space → create Project with a goal.
2. Upload a short PDF; wait for Ready (or Failed with an error).
3. Tutor: ask something in the notes (expect citations). Ask something off-topic (expect insufficient-evidence banner).
4. Quiz: answer mix of MCQ/open; confirm feedback and mastery movement on Growth.
5. Check project Analytics and Home “continue learning”.
6. Confirm another registered user cannot open the first user’s project by ID.

As admin (`admin@studycompanion.local`):

1. Open `/admin`: users, jobs, AI usage, health.
2. Drill into `/admin/users/:id`.

## Known eval gaps

- No human-rated groundedness set against real Gemini outputs.
- Hash embeddings will miss paraphrases that a real encoder would catch.
- Heuristic provider answers are template JSON; they are for pipeline connectivity, not pedagogy quality.
