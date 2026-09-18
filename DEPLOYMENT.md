# Lumina Study — Production Deployment Guide

This guide provides the complete, step-by-step procedure for deploying Lumina Study to production using:
- **Frontend:** React 18 + Vite on **Vercel**
- **Backend & AI Service:** Spring Boot (Java 17) + FastAPI (Python 3.11) unified into a single Docker container on **Render**
- **Database:** **MongoDB Atlas**
- **Cache & Rate Limiting:** **Managed Redis** (Upstash or Redis Cloud)
- **AI Providers:** **Google Gemini** & **Groq** via Runtime Provider Management

---

## Target Production Architecture

```
                    LEARNER / ADMIN
                          |
                          v
                      VERCEL
             React 18 + Vite Frontend
            (https://your-app.vercel.app)
                          |
                        HTTPS (REST & SSE Stream)
                          |
                          v
                      RENDER
         ┌──────────────────────────────────────┐
         │ Single Docker Web Service (:8080)    │
         │                                      │
         │   Spring Boot 3.2 (Java 17) :8080    │
         │           |                          │
         │           v (Internal Loopback)      │
         │   FastAPI AI Service :8000           │
         │   (Bound to 0.0.0.0, Not Public)     │
         │                                      │
         └──────────────┬───────────────────────┘
                        |
            ┌───────────┴───────────┐
            v                       v
     MongoDB Atlas            Managed Redis
 (Encrypted Cluster)      (Upstash / Redis Cloud)
            |
            v
   Google Gemini & Groq APIs
 (Managed via Admin UI at runtime)
```

---

## Phase 1: Prepare Your Git Repository

> [!WARNING]
> Ensure your local `.env` file is NOT committed! Check `.gitignore` to confirm `.env` and `.env.*` are ignored.

1. Review your repository status:
   ```bash
   git status
   ```
2. Add the deployment configuration files:
   ```bash
   git add .gitignore .dockerignore Dockerfile.production start-production.sh render.yaml frontend/vercel.json
   git add backend/ frontend/ ai-service/ .env.example
   ```
3. Commit and push to your GitHub repository:
   ```bash
   git commit -m "feat: configure production deployment for Vercel and Render"
   git push origin main
   ```

---

## Phase 2: Set Up MongoDB Atlas

1. Log in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. **Create a Database Cluster:**
   - Choose the **M0 Free Tier** (or M10+ for dedicated production).
   - Select your preferred cloud provider and region (match your Render region, e.g., AWS Oregon `us-west-2`).
3. **Configure Database Access (User):**
   - Navigate to **Security → Database Access → Add New Database User**.
   - Authentication Method: **Password**.
   - Username: `lumina_prod`
   - Password: Click **Autogenerate Secure Password** and copy it safely.
   - Database User Privileges: **Read and write to any database**.
4. **Configure Network Access (Firewall):**
   - Navigate to **Security → Network Access → Add IP Address**.
   - Select **Allow Access from Anywhere (`0.0.0.0/0`)** because Render web service IPs are dynamic.
   - Click **Confirm**.
5. **Obtain Connection String:**
   - Navigate to **Deployment → Databases → Connect**.
   - Select **Drivers** (Java or Python).
   - Copy the URI template:
     ```text
     mongodb+srv://lumina_prod:<password>@cluster0.abcde.mongodb.net/studycompanion?retryWrites=true&w=majority
     ```
   - Replace `<password>` with your actual password. This is your `MONGO_URI`.

---

## Phase 3: Set Up Managed Redis

1. Sign up or log in to [Upstash Redis](https://upstash.com/) or [Redis Cloud](https://redis.io/cloud/).
2. **Create Database:**
   - Name: `lumina-study-redis`
   - Region: Match your Render region (e.g., `us-west-1` or `us-east-1`).
   - Eviction: No eviction / standard LRU.
3. **Obtain Connection String:**
   - In Upstash, find the **Node / Redis URL** string in the format:
     ```text
     rediss://default:your-secure-token@your-endpoint.upstash.io:6379
     ```
   - (Note: Both standard `redis://` and TLS `rediss://` are supported by Spring Boot and ai-service). This is your `REDIS_URL`.

---

## Phase 4: Deploy Backend & AI Service to Render

1. Log in to your [Render Dashboard](https://dashboard.render.com/).
2. Click **New + → Web Service**.
3. Connect your GitHub repository (`Ai Prof Work` / `lumina-study`).
4. **Configure Web Service:**
   - **Name:** `lumina-study-backend`
   - **Region:** Oregon (US West) or Frankfurt (EU)
   - **Environment:** **Docker**
   - **Dockerfile Path:** `./Dockerfile.production`
   - **Docker Context:** `.`
   - **Instance Type:** Starter ($7/mo) or standard tier (provides 512MB–2GB RAM for JVM + Python).
5. **Health Check:**
   - Expand **Advanced**.
   - Set **Health Check Path:** `/actuator/health`
6. **Configure Environment Variables:**
   Under **Environment Variables**, add the following:

   | Key | Value | Notes |
   | :--- | :--- | :--- |
   | `PORT` | `8080` | Render routes public HTTP traffic to this port |
   | `SPRING_PROFILES_ACTIVE` | `prod` | Activates production profile |
   | `MONGO_URI` | `mongodb+srv://lumina_prod:...` | Your MongoDB Atlas connection string |
   | `REDIS_URL` | `rediss://default:...` | Your Managed Redis URL |
   | `JWT_SECRET` | *(64-char random hex)* | See secret generation command below |
   | `INTERNAL_SERVICE_SECRET` | *(64-char random hex)* | Shared secret between Spring Boot and FastAPI |
   | `AI_ENCRYPTION_KEY` | *(64-char random hex)* | Key for encrypting stored Gemini/Groq keys |
   | `AI_SERVICE_URL` | `http://127.0.0.1:8000` | Loopback address inside container |
   | `SPRING_INTERNAL_URL` | `http://127.0.0.1:8080` | Loopback address inside container |
   | `PRIMARY_PROVIDER` | `gemini` | Default primary provider |
   | `FALLBACK_PROVIDER` | `groq` | Default fallback provider |
   | `CORS_ORIGINS` | `http://localhost:5173` | Set temporarily; update in Phase 6 with Vercel URL |

   > [!TIP]
   > **How to generate 64-character random secrets:**
   > In PowerShell:
   > ```powershell
   > -join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })
   > ```
   > Or on Linux/macOS:
   > ```bash
   > openssl rand -hex 32
   > ```

7. Click **Create Web Service**.
8. Render will build the Docker container, launch FastAPI on port 8000, wait for health, and launch Spring Boot on port 8080.
9. Verify in the logs that both services say `ready`, and copy your Render URL:
   `https://lumina-study-backend.onrender.com`

---

## Phase 5: Deploy Frontend to Vercel

1. Log in to [Vercel](https://vercel.com/).
2. Click **Add New… → Project**.
3. Import your GitHub repository.
4. **Configure Project:**
   - **Framework Preset:** **Vite**
   - **Root Directory:** Edit and select `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
5. **Environment Variables:**
   Under **Environment Variables**, add:

   | Key | Value |
   | :--- | :--- |
   | `VITE_API_BASE_URL` | `https://lumina-study-backend.onrender.com` |

   *(Use your actual Render URL obtained in Phase 4, with NO trailing slash)*.

6. Click **Deploy**.
7. Once deployment finishes, Vercel will assign you a live production URL:
   `https://lumina-study.vercel.app`

---

## Phase 6: Update CORS in Render

Now that your Vercel URL is known, restrict Render's CORS to your production domain:

1. In the **Render Dashboard**, go to `lumina-study-backend` → **Environment**.
2. Update the `CORS_ORIGINS` variable:
   ```text
   https://lumina-study.vercel.app,http://localhost:5173
   ```
3. Click **Save Changes**. Render will automatically restart the web service with the new CORS policy.

---

## Phase 7: Configure AI Keys via Admin Dashboard (Zero Redeploy!)

Because Lumina Study features encrypted **Runtime Provider Management**, you do not need to bake API keys into environment variables or redeploy when keys change!

1. Open your production frontend URL: `https://lumina-study.vercel.app`.
2. Register an account or log in with your admin credentials.
   *(To grant the ADMIN role to your first registered user, update their document in MongoDB Atlas: `db.users.updateOne({ email: "you@example.com" }, { $set: { role: "ROLE_ADMIN" } })`)*.
3. Click the **Admin** shield icon in the top navigation.
4. Select the **AI Providers & Models** tab.
5. **Configure Google Gemini:**
   - Click **Configure Key** under Google Gemini.
   - Paste your Gemini API key from Google AI Studio.
   - Click **Test Connection** (verifies live network connectivity with Google AI).
   - Click **Save Key**.
6. **Configure Groq:**
   - Click **Configure Key** under Groq.
   - Paste your Groq API key from Groq Console.
   - Click **Test Connection**.
   - Click **Save Key**.
7. Select your preferred **Primary Model** (e.g., `gemini-2.5-flash` or `qwen/qwen3.8-27b`) and **Fallback Model**.

Your system is now 100% active and running on live AI!

---

## Phase 8: Production Smoke Test (End-to-End)

Run through this 16-step verification to confirm complete system integrity:

1. [ ] **Registration:** Register a new user account on the Vercel frontend.
2. [ ] **JWT Session:** Verify automatic redirection to dashboard and persistent auth tokens.
3. [ ] **Create Space:** Create a new Study Space (e.g., "Computer Science").
4. [ ] **Create Project:** Create a project inside that space (e.g., "Machine Learning").
5. [ ] **Upload PDF:** Upload a sample PDF textbook chapter or lecture notes.
6. [ ] **Ingest Processing:** Verify the badge transitions: `QUEUED` → `PROCESSING` → `Ready`.
7. [ ] **Ask Tutor:** Open the AI Tutor chat and ask a question from the uploaded PDF.
8. [ ] **Verify Citations:** Ensure the tutor returns an answer with a clickable PDF citation snippet and page number.
9. [ ] **Unsupported Guardrail:** Ask an unrelated question (e.g., "How to bake a chocolate cake?"). Ensure the tutor safely refuses due to the cosine 0.18 threshold.
10. [ ] **Generate Quiz:** Click **Generate Adaptive Quiz**. Verify MCQ questions are generated dynamically from the document.
11. [ ] **Submit Quiz:** Answer the questions and submit. Verify score calculation.
12. [ ] **Mastery Tracking:** Check the Concept Mastery progress bar and trend indicators.
13. [ ] **Admin Dashboard:** Open `/admin`. Verify the real user counts, space counts, and project counts.
14. [ ] **Live Telemetry:** Check the **AI Observability & LLM Stack** tab to confirm actual token counts, latencies, and provider attribution (Gemini / Groq).
15. [ ] **Microservices Health:** Open the **Health** tab. Confirm real latencies for MongoDB, Redis, and FastAPI. Confirm Incident Log displays *"No incidents recorded. All systems operating normally."*
16. [ ] **Run Evaluation Suite:** Click **Run Evaluation Suite** in the Admin header. Confirm all functional test cases and Pydantic schema checks pass.
