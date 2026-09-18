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

## Manual QA (Full End-to-End Learning Loop)

As a student:

1. **Onboarding:** Register a new account → create a Space → create a Project with an explicit learning goal.
2. **Materials Ingestion:** Upload a sample PDF; monitor the status badge until it transitions to `Ready`.
3. **Concept Map:** Navigate to the Concept Map tab; verify instant 0ms cached loading of nodes and relationship edges; test "Rescan Materials" to regenerate.
4. **Grounded Tutor:** 
   - Ask an in-domain question from the PDF: observe real-time SSE token streaming and verify citation chips (filename, page number, and quote).
   - Ask an irrelevant/off-topic question: verify early anti-hallucination cutoff with an insufficient-evidence alert.
5. **Smart Flashcards:** Generate flashcards; practice flip cards and submit ratings (Again, Hard, Good, Easy); verify SM-2 next review date updates.
6. **Adaptive Quiz:** Launch an adaptive quiz session; answer a combination of MCQ and open-ended questions; verify automated grading and mastery calculation updates.
7. **Mistakes Notebook:** View recorded errors from the quiz; run AI diagnostic analysis to review misconceptions.
8. **Study Planner:** Generate a personalized timeline based on exam date and available hours.
9. **Growth & Analytics:** Inspect mastery radar, streak counters, and category breakdowns.
10. **Data Isolation Security:** Attempt to access project resources directly via URL under a different user account to verify 403 Forbidden enforcement.

As an administrator (`admin@studycompanion.local`):

1. Access `/admin`: inspect registered users, active background jobs, AI usage logs, token totals, and MongoDB health.
2. Drill into individual user profiles under `/admin/users/:id`.
3. Open the Runtime Provider Management tab: test API keys and switch between Gemini, Groq, and Heuristic providers.


## Known eval gaps

- No human-rated groundedness set against real Gemini outputs.
- Hash embeddings will miss paraphrases that a real encoder would catch.
- Heuristic provider answers are template JSON; they are for pipeline connectivity, not pedagogy quality.
