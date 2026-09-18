#!/bin/bash
set -eo pipefail

echo "=================================================="
echo " Starting Lumina Study Production Unified Server"
echo "=================================================="

# Ensure upload directory exists
mkdir -p "${FILE_STORAGE_DIR:-/app/uploads}"

FASTAPI_PID=""
SPRING_PID=""

cleanup() {
    echo "Received termination signal. Shutting down gracefully..."
    if [ -n "$FASTAPI_PID" ] && kill -0 "$FASTAPI_PID" 2>/dev/null; then
        echo "Stopping FastAPI (PID $FASTAPI_PID)..."
        kill -TERM "$FASTAPI_PID" 2>/dev/null || true
    fi
    if [ -n "$SPRING_PID" ] && kill -0 "$SPRING_PID" 2>/dev/null; then
        echo "Stopping Spring Boot (PID $SPRING_PID)..."
        kill -TERM "$SPRING_PID" 2>/dev/null || true
    fi
    wait
    echo "All processes stopped."
    exit 0
}

trap cleanup SIGTERM SIGINT

# 1. Start FastAPI in the background on port 8000
echo "[1/4] Starting FastAPI AI Service on port 8000..."
cd /app/ai-service
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 &
FASTAPI_PID=$!
echo "FastAPI launched with PID: $FASTAPI_PID"

# 2. Wait for FastAPI to become ready
echo "[2/4] Waiting for FastAPI AI Service to be ready on http://127.0.0.1:8000/health..."
MAX_RETRIES=30
RETRY_COUNT=0
READY=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if ! kill -0 "$FASTAPI_PID" 2>/dev/null; then
        echo "ERROR: FastAPI process died unexpectedly during startup."
        exit 1
    fi

    if python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2)" >/dev/null 2>&1; then
        READY=1
        echo "FastAPI is healthy and ready!"
        break
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "Waiting for FastAPI... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 1
done

if [ $READY -ne 1 ]; then
    echo "ERROR: FastAPI did not become ready within $MAX_RETRIES seconds."
    kill -TERM "$FASTAPI_PID" 2>/dev/null || true
    exit 1
fi

# 3. Start Spring Boot on port 8080
echo "[3/4] Starting Spring Boot on port 8080..."
cd /app
java -Dserver.port=8080 \
     -Dapp.ai-service.url=http://127.0.0.1:8000 \
     -XX:+UseContainerSupport \
     -XX:MaxRAMPercentage=75.0 \
     -jar /app/app.jar &
SPRING_PID=$!
echo "Spring Boot launched with PID: $SPRING_PID"

# 4. Supervise both processes
echo "[4/4] Both services active. Supervising processes..."

while true; do
    if ! kill -0 "$FASTAPI_PID" 2>/dev/null; then
        echo "FATAL: FastAPI process (PID $FASTAPI_PID) exited."
        cleanup
        exit 1
    fi
    if ! kill -0 "$SPRING_PID" 2>/dev/null; then
        echo "FATAL: Spring Boot process (PID $SPRING_PID) exited."
        cleanup
        exit 1
    fi
    sleep 2
done
