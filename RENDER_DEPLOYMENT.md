# Deploying Spring Boot & Python AI Service Separately on Render

This guide walks you through deploying **Python AI Service** and **Spring Boot Backend** as independent, separately managed web services on [Render](https://render.com).

---

## Architecture Overview

```
[ Frontend (Vite React) ]
         │
         ▼ (HTTP /api/*)
[ Spring Boot Backend ] ──(Downloads PDF: /api/internal/materials/{id}/file)──┐
  (Port 8080)                                                                 │
         │                                                                    ▼
         └─────────────(Calls AI: /tutor, /quiz, /ingest)──────────► [ Python AI Service ]
                                                                       (Port 8000)
                                                                       • Groq Primary LLM
                                                                       • Gemini Fallback LLM
                                                                       • BAAI Local Embeddings
```

---

## Prerequisites
1. A free or paid **Render** account at [dashboard.render.com](https://dashboard.render.com).
2. A cloud **MongoDB database** (e.g. free cluster from [MongoDB Atlas](https://www.mongodb.com/atlas)).
3. Your **Groq API key** from [console.groq.com](https://console.groq.com).
4. (Optional) **Gemini API key** from [aistudio.google.com](https://aistudio.google.com) for backup failover.
5. (Optional) Free cloud **Redis** (e.g. from [Upstash](https://upstash.com) or Render Redis).

---

## Method 1: Automatic 1-Click Deployment (Render Blueprint)

We have already configured [render.yaml](file:///c:/Users/kampa/OneDrive/Desktop/Ai%20Prof%20Work/render.yaml) in your repository root.

1. Push your latest code to your GitHub / GitLab repository.
2. In the Render Dashboard, click **New +** → **Blueprint**.
3. Select your repository (`Ai Prof Work`).
4. Render will read `render.yaml` and discover the two services:
   - `lumina-ai-service`
   - `lumina-backend`
5. Fill in the prompted secret values:
   - `MONGO_URI` / `SPRING_DATA_MONGODB_URI`: Your MongoDB Atlas URI.
   - `GROQ_API_KEY`: Your Groq API key (`gsk_...`).
   - `GEMINI_API_KEY`: (Optional) Your Gemini API key.
   - `CORS_ORIGINS`: Your frontend URL (e.g., `https://your-frontend.onrender.com` or `*`).
6. Click **Apply**. Render will automatically:
   - Build and start both containers independently.
   - Interconnect them with internal networking and shared secrets.

---

## Method 2: Manual Deployment via Render Dashboard

If you prefer configuring services manually in the Render UI, follow these steps:

### Step 1: Deploy the Python AI Service

1. Click **New +** → **Web Service**.
2. Connect your Git repository.
3. Configure the service:
   - **Name**: `lumina-ai-service`
   - **Region**: Oregon (or matching your database region)
   - **Environment**: **Docker**
   - **Docker Context**: `./ai-service`
   - **Dockerfile Path**: `./ai-service/Dockerfile`
   - **Instance Type**: Starter (or higher)
4. Set **Health Check Path**: `/health`
5. Expand **Environment Variables** and add:
   | Key | Value | Description |
   |---|---|---|
   | `PORT` | `8000` | Port uvicorn binds to |
   | `PRIMARY_PROVIDER` | `groq` | Primary ultra-fast LLM |
   | `FALLBACK_PROVIDER` | `gemini` | Backup LLM |
   | `EMBEDDING_DIM` | `384` | BAAI/bge-small-en-v1.5 dimension |
   | `RETRIEVAL_THRESHOLD` | `0.18` | Relevance cutoff |
   | `MONGO_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/studycompanion` | Your MongoDB URI |
   | `INTERNAL_SERVICE_SECRET` | *(generate a random string, e.g. `sec_7894a73b5f`)* | Shared internal key |
   | `GROQ_API_KEY` | `gsk_...` | Groq key |
   | `GEMINI_API_KEY` | `AQ...` | (Optional) Gemini key |
   | `SPRING_INTERNAL_URL` | *(Leave blank for now, update after Step 2)* | Points to Spring Boot URL |
6. Click **Deploy Web Service**.
7. Once deployed, copy your AI Service URL (e.g., `https://lumina-ai-service.onrender.com`).

---

### Step 2: Deploy the Spring Boot Backend

1. Click **New +** → **Web Service**.
2. Connect your Git repository.
3. Configure the service:
   - **Name**: `lumina-backend`
   - **Region**: Same region as Step 1
   - **Environment**: **Docker**
   - **Docker Context**: `./backend`
   - **Dockerfile Path**: `./backend/Dockerfile`
   - **Instance Type**: Starter (or higher)
4. Set **Health Check Path**: `/actuator/health`
5. Expand **Environment Variables** and add:
   | Key | Value | Description |
   |---|---|---|
   | `PORT` | `8080` | Spring Boot port |
   | `SPRING_PROFILES_ACTIVE` | `prod` | Production Spring profile |
   | `SPRING_DATA_MONGODB_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/studycompanion` | Same MongoDB URI as Step 1 |
   | `INTERNAL_SERVICE_SECRET` | *(Must match the secret from Step 1)* | Shared internal key |
   | `AI_SERVICE_URL` | `https://lumina-ai-service.onrender.com` | URL from Step 1 |
   | `JWT_SECRET` | *(random 32+ char string)* | Token encryption |
   | `FILE_STORAGE_DIR` | `/tmp/uploads` | Temporary upload directory |
   | `CORS_ORIGINS` | `*` (or your frontend domain) | Allowed web clients |
6. Click **Deploy Web Service**.
7. Once deployed, copy your backend URL (e.g., `https://lumina-backend.onrender.com`).

---

### Step 3: Link Spring Boot URL back to Python AI Service

1. Go back to `lumina-ai-service` in Render.
2. Go to **Environment**.
3. Update `SPRING_INTERNAL_URL` with your Spring Boot URL:
   - `SPRING_INTERNAL_URL` = `https://lumina-backend.onrender.com`
4. Click **Save Changes** (Render will automatically redeploy).

---

### Step 4: Deploy the React Frontend (Optional)

1. Click **New +** → **Static Site**.
2. Connect your Git repository.
3. Configure:
   - **Name**: `lumina-study-frontend`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Under **Environment Variables**:
   - `VITE_API_BASE_URL` = `https://lumina-backend.onrender.com`
5. Add a Rewrite Rule (in **Redirects/Rewrites**):
   - Source: `/*`
   - Destination: `/index.html`
   - Action: `Rewrite`
6. Click **Deploy Static Site**.

---

## Verification & Health Checks

Once deployed, you can verify both services in your browser or terminal:

1. **Python AI Service Health**:
   ```bash
   curl https://lumina-ai-service.onrender.com/health
   # Returns: {"status":"ok","models":{"primary":"groq","fallback":"gemini","embedding":"bge-small-en-v1.5"}}
   ```

2. **Spring Boot Health**:
   ```bash
   curl https://lumina-backend.onrender.com/actuator/health
   # Returns: {"status":"UP"}
   ```

3. **Admin Dashboard Verification**:
   - Open your frontend app and navigate to **Admin** (`admin@gmail.com` / `Admin@123`).
   - You will see:
     - **Groq Cloud** marked as **PRIMARY** (`llama-3.3-70b-versatile`).
     - **Google Gemini** marked as **BACKUP** (`gemini-2.0-flash`).
     - **Dedicated Embedding Engine**: `BAAI/bge-small-en-v1.5` active via local ONNX.
     - Click **Test Connection** to verify <300ms response times.
