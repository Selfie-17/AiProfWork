# Walkthrough: Persistent Fixed Concept Graph & Explicit Regeneration

We have updated the Concept Graph workflow so it is **generated once, persisted in MongoDB, and loaded instantly (0ms latency, fixed positions)** whenever navigating to the page. Regeneration is now an explicit user action.

---

## 1. Changes Made

### Persistence & 0ms Navigation
- **Domain & Storage**: Created [`ConceptGraph.java`](file:///c:/Users/kampa/OneDrive/Desktop/Ai%20Prof%20Work/backend/src/main/java/com/studycompanion/domain/ConceptGraph.java) and [`ConceptGraphRepository.java`](file:///c:/Users/kampa/OneDrive/Desktop/Ai%20Prof%20Work/backend/src/main/java/com/studycompanion/repo/ConceptGraphRepository.java) to store the generated nodes, edges, and category hierarchy in MongoDB (`concept_graphs` collection).
- **Controller Logic**:
  - `GET /api/projects/{projectId}/concepts/graph`: Checks for an existing saved graph in MongoDB. If present, it enriches the fixed nodes with current mastery scores and returns immediately without calling the AI service.
  - `POST /api/projects/{projectId}/concepts/graph/regenerate`: Dedicated endpoint that triggers an AI rescan of materials and updates the persisted graph in MongoDB.
- **Frontend Integration**:
  - In [`ConceptMap.jsx`](file:///c:/Users/kampa/OneDrive/Desktop/Ai%20Prof%20Work/frontend/src/pages/ConceptMap.jsx), navigating to the tab performs an instant cached read (`GET`).
  - Clicking the **"Rescan Materials"** button performs an explicit `POST .../regenerate`, giving the user full control over when new AI processing occurs.

---

## 2. Verification
- `mvn compile` in `backend`: **BUILD SUCCESS** (70 source files).
- `npm run build` in `frontend`: **✓ built in 9.60s** (0 errors).
