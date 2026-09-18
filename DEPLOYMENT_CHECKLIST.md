# Lumina Study — Production Deployment Checklist

Use this checklist before and after launching Lumina Study into public production.

---

## 1. Security & Secrets Hardening
- [ ] **API Keys Rotated:** Existing Gemini and Groq keys rotated in Google AI Studio and Groq Console.
- [ ] **No Secrets Committed:** `.env` and `.env.*` verified ignored by `.gitignore` and absent from git history.
- [ ] **Strong JWT Secret:** Generated a unique 256-bit random hex string for `JWT_SECRET`.
- [ ] **Strong Internal Secret:** Generated a unique 256-bit random hex string for `INTERNAL_SERVICE_SECRET`.
- [ ] **Strong Encryption Key:** Generated a unique 256-bit random hex string for `AI_ENCRYPTION_KEY`.
- [ ] **MongoDB Authenticated:** MongoDB Atlas cluster requires strong username/password credentials.
- [ ] **Redis Authenticated:** Managed Redis requires TLS / password authentication.
- [ ] **CORS Restricted:** `CORS_ORIGINS` explicitly matches `https://your-app.vercel.app` (no wildcard `*` allowed in prod).
- [ ] **FastAPI Not Public:** Port 8000 is internal loopback only; Render exposes only port 8080.
- [ ] **MongoDB Not Public:** MongoDB Atlas IP whitelist configured, cluster not accessible without credentials.
- [ ] **Redis Not Public:** Redis port protected by authentication token.

---

## 2. Backend (Spring Boot)
- [ ] **Build Verification:** `mvn clean compile` and `mvn test` succeed with 0 failures.
- [ ] **Actuator Health:** `/actuator/health` returns `{"status":"UP"}`.
- [ ] **AI Service Connection:** `AI_SERVICE_URL` set to `http://127.0.0.1:8000` inside the combined Render container.
- [ ] **Atlas Connectivity:** Spring Boot successfully connects to MongoDB Atlas without credentials logged.
- [ ] **Redis Connectivity:** Spring Boot successfully connects to managed Redis for rate limiting and quotas.

---

## 3. AI Service (FastAPI)
- [ ] **FastAPI Service:** Launches on port 8000 and `/health` returns `{"ok":true}`.
- [ ] **Runtime Key Manager:** Keys stored AES-256-GCM encrypted in MongoDB, loaded at runtime without redeploy.
- [ ] **Gemini Connectivity:** Test connection passes via Admin UI.
- [ ] **Groq Connectivity:** Test connection passes via Admin UI.
- [ ] **Automatic Fallback:** Gracefully degrades from primary to fallback provider upon rate limit (429) or outage.
- [ ] **Model Selection:** Dynamic model dropdown lists compatible models.

---

## 4. Frontend (React 18 + Vite on Vercel)
- [ ] **Vercel Build:** `npm run build` generates production bundle in `dist/` with exit code 0.
- [ ] **API URL Injected:** `VITE_API_BASE_URL` points to `https://your-render-service.onrender.com` at build time.
- [ ] **No Localhost in Prod:** All API calls route through `api.js` using `VITE_API_BASE_URL`.
- [ ] **SPA Routing:** `frontend/vercel.json` rewrites all paths `/(.*)` to `/index.html`.

---

## 5. File Storage & Document Processing
- [ ] **Uploads Directory:** `/app/uploads` initialized on container boot.
- [ ] **Background Processing:** PDF upload returns immediate HTTP response; ingestion runs asynchronously.
- [ ] **OCR Extraction:** Tesseract OCR extracts text from scanned documents.
- [ ] **Chunking & Embeddings:** Documents are chunked and vector embeddings are stored in MongoDB.

---

## 6. Observability & Telemetry
- [ ] **Real Telemetry:** AI request count, provider, model, latency, and tokens reflect actual calls.
- [ ] **No Fake Metrics:** Admin dashboard latencies and statuses derived directly from live health checks.
- [ ] **Error Auditing:** AI provider exceptions logged to `aiUsageLog` and reflected in Admin Incident Log.
- [ ] **Fallback Tracking:** Telemetry clearly flags when a fallback model was used versus primary.

---

## 7. Deployment & Verification
- [ ] **Render Web Service:** Built from `Dockerfile.production`, launches FastAPI then Spring Boot, health check green.
- [ ] **Vercel Deployment:** Frontend accessible over HTTPS with zero console errors.
- [ ] **End-to-End Smoke Test:** Registered a user, created a space, uploaded a PDF, chatted with tutor, verified citations, generated quiz, and inspected Admin observability.
