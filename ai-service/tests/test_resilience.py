import concurrent.futures
import time
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.core.context import get_correlation_id, set_correlation_id, correlation_id_var
from app.main import app
from app.services.cache_service import cache_service
from app.services.llm_client import LLMResponse, log_usage
from app.services.provider_manager import (
    CircuitBreaker,
    CircuitState,
    RuntimeProviderManager,
)


# =========================================================================
# 1. Circuit Breaker State Transitions (Local Fallback & General Behavior)
# =========================================================================

def test_circuit_breaker_closed_allows_requests():
    cb = CircuitBreaker("TEST_CB", failure_threshold=5, failure_window=60.0, recovery_timeout=30.0)
    cb._get_redis = lambda: None  # Force local memory mode
    assert cb.can_attempt() is True
    assert cb.state == CircuitState.CLOSED


def test_circuit_breaker_transient_failures_open_circuit():
    cb = CircuitBreaker("TEST_CB", failure_threshold=5, failure_window=60.0, recovery_timeout=0.1)
    cb._get_redis = lambda: None

    for _ in range(4):
        cb.record_failure()
        assert cb.state == CircuitState.CLOSED
        assert cb.can_attempt() is True

    # 5th failure trips the breaker to OPEN
    cb.record_failure()
    assert cb.state == CircuitState.OPEN
    assert cb.can_attempt() is False


def test_circuit_breaker_cooldown_and_half_open_probe():
    cb = CircuitBreaker("TEST_CB", failure_threshold=3, failure_window=60.0, recovery_timeout=0.08)
    cb._get_redis = lambda: None

    for _ in range(3):
        cb.record_failure()
    assert cb.state == CircuitState.OPEN
    assert cb.can_attempt() is False

    # Wait for cooldown
    time.sleep(0.1)
    # Next attempt should transition into HALF_OPEN
    assert cb.can_attempt() is True
    assert cb.state == CircuitState.HALF_OPEN

    # Success restores to CLOSED
    cb.record_success()
    assert cb.state == CircuitState.CLOSED
    assert cb.can_attempt() is True


def test_circuit_breaker_failed_probe_reopens():
    cb = CircuitBreaker("TEST_CB", failure_threshold=2, failure_window=60.0, recovery_timeout=0.08)
    cb._get_redis = lambda: None

    cb.record_failure()
    cb.record_failure()
    assert cb.state == CircuitState.OPEN

    time.sleep(0.1)
    assert cb.can_attempt() is True
    assert cb.state == CircuitState.HALF_OPEN

    # Failed probe immediately reopens breaker
    cb.record_failure()
    assert cb.state == CircuitState.OPEN
    assert cb.can_attempt() is False


def test_non_transient_client_errors_do_not_trip_circuit():
    mgr = RuntimeProviderManager()
    groq_cb = mgr.get_circuit_breaker("GROQ")
    groq_cb._get_redis = lambda: None
    groq_cb.reset()

    # Record 10 non-transient failures (e.g. 400, 401, 403, 404)
    for _ in range(10):
        mgr.record_provider_failure("GROQ", is_transient=False)

    assert groq_cb.state == CircuitState.CLOSED
    assert len(groq_cb.failure_timestamps) == 0
    assert groq_cb.can_attempt() is True


# =========================================================================
# 2. Redis-Backed Circuit Breaker & Concurrency Tests
# =========================================================================

class FakeRedis:
    """In-memory Redis simulator with thread-safe atomics for Lua/ZSET operations."""

    def __init__(self):
        self.store = {}
        self.zsets = {}

    def get(self, key):
        return self.store.get(key)

    def set(self, key, val, nx=False, ex=None, px=None):
        if nx and key in self.store:
            return False
        self.store[key] = str(val)
        return True

    def delete(self, *keys):
        for k in keys:
            self.store.pop(k, None)
            self.zsets.pop(k, None)

    def zcard(self, key):
        return len(self.zsets.get(key, {}))

    def eval(self, script, numkeys, *args):
        # Emulate _RECORD_FAILURE_LUA
        failures_key, state_key, opened_at_key = args[0], args[1], args[2]
        now = float(args[3])
        cutoff = float(args[4])
        threshold = int(args[5])
        member = str(args[7])

        zset = self.zsets.setdefault(failures_key, {})
        # Prune old members
        to_del = [m for m, score in zset.items() if score < cutoff]
        for m in to_del:
            del zset[m]
        zset[member] = now

        count = len(zset)
        if count >= threshold:
            self.store[state_key] = "OPEN"
            self.store[opened_at_key] = str(now)
            return [1, count]
        return [0, count]


def test_redis_circuit_breaker_single_probe_lock():
    fake_redis = FakeRedis()
    cb = CircuitBreaker("REDIS_TEST", failure_threshold=2, failure_window=60.0, recovery_timeout=0.05)
    cb._get_redis = lambda: fake_redis

    cb.record_failure()
    cb.record_failure()
    assert cb.state == CircuitState.OPEN

    time.sleep(0.06)
    # First worker attempts: should successfully acquire probe
    worker1_allowed = cb.can_attempt()
    assert worker1_allowed is True
    assert cb.state == CircuitState.HALF_OPEN

    # Second worker attempts while HALF_OPEN: probe lock was already claimed, must be blocked
    worker2_allowed = cb.can_attempt()
    assert worker2_allowed is False


def test_redis_concurrency_failure_recording():
    fake_redis = FakeRedis()
    cb = CircuitBreaker("REDIS_CONCURRENT", failure_threshold=5, failure_window=60.0, recovery_timeout=30.0)
    cb._get_redis = lambda: fake_redis

    # Simulate 10 threads concurrently reporting failures
    def worker():
        cb.record_failure()

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(worker) for _ in range(10)]
        concurrent.futures.wait(futures)

    assert cb.state == CircuitState.OPEN
    status = cb.get_status()
    assert status["state"] == "OPEN"
    assert status["failuresInWindow"] == 10


def test_redis_failure_fallback_to_local_memory():
    cb = CircuitBreaker("REDIS_DOWN_TEST", failure_threshold=2, failure_window=60.0, recovery_timeout=30.0)

    def broken_redis():
        mock = MagicMock()
        mock.get.side_effect = Exception("Redis connection refused")
        mock.eval.side_effect = Exception("Redis connection refused")
        return mock

    cb._get_redis = broken_redis

    # Should not crash; must log warning and fall back to local memory
    cb.record_failure()
    cb.record_failure()
    assert cb.can_attempt() is False
    assert cb._local_state == CircuitState.OPEN


# =========================================================================
# 3. Provider/Model-Aware Cache Key Tests
# =========================================================================

def test_cache_keys_are_provider_and_model_aware():
    cache_service.llm_cache.clear()

    # Same prompt, provider "groq", model "llama-3.3-70b-versatile"
    cache_service.set_llm(
        feature="tutor",
        provider="groq",
        model="llama-3.3-70b-versatile",
        prompt="Explain photosynthesis",
        schema=False,
        response_dict={"text": "Photosynthesis via Groq Llama 70B"},
    )

    # 1. Exact match -> Hit
    hit = cache_service.get_llm("tutor", "groq", "llama-3.3-70b-versatile", "Explain photosynthesis", schema=False)
    assert hit is not None
    assert hit["text"] == "Photosynthesis via Groq Llama 70B"

    # 2. Same prompt, different provider ("gemini") -> Miss (prevents collision!)
    miss_provider = cache_service.get_llm("tutor", "gemini", "llama-3.3-70b-versatile", "Explain photosynthesis", schema=False)
    assert miss_provider is None

    # 3. Same prompt and provider, different model ("llama-3.1-8b-instant") -> Miss
    miss_model = cache_service.get_llm("tutor", "groq", "llama-3.1-8b-instant", "Explain photosynthesis", schema=False)
    assert miss_model is None

    # 4. Same prompt and provider and model, different schema flag -> Miss
    miss_schema = cache_service.get_llm("tutor", "groq", "llama-3.3-70b-versatile", "Explain photosynthesis", schema=True)
    assert miss_schema is None

    # 5. Storing Gemini response separately does not overwrite Groq
    cache_service.set_llm(
        feature="tutor",
        provider="gemini",
        model="gemini-2.0-flash",
        prompt="Explain photosynthesis",
        schema=False,
        response_dict={"text": "Photosynthesis via Gemini 2.0"},
    )

    groq_again = cache_service.get_llm("tutor", "groq", "llama-3.3-70b-versatile", "Explain photosynthesis", schema=False)
    gemini_again = cache_service.get_llm("tutor", "gemini", "gemini-2.0-flash", "Explain photosynthesis", schema=False)
    assert groq_again["text"] == "Photosynthesis via Groq Llama 70B"
    assert gemini_again["text"] == "Photosynthesis via Gemini 2.0"


def test_cache_legacy_signature_backwards_compatibility():
    cache_service.llm_cache.clear()

    # Legacy set call: set_llm(feature, prompt, schema, response_dict)
    cache_service.set_llm("quiz", "What is an eigenvalue?", False, {"text": "Legacy quiz answer"})

    # Legacy get call: get_llm(feature, prompt, schema)
    cached = cache_service.get_llm("quiz", "What is an eigenvalue?", schema=False)
    assert cached is not None
    assert cached["text"] == "Legacy quiz answer"


# =========================================================================
# 4. Correlation ID Propagation & Telemetry Tests
# =========================================================================

def test_fastapi_middleware_preserves_correlation_id():
    client = TestClient(app)

    # 1. Incoming X-Correlation-ID is preserved and echoed
    resp = client.get("/health", headers={"X-Correlation-ID": "test-cid-12345"})
    assert resp.status_code == 200
    assert resp.headers.get("X-Correlation-ID") == "test-cid-12345"

    # 2. When missing, a new req_<id> is generated
    resp2 = client.get("/health")
    assert resp2.status_code == 200
    generated_cid = resp2.headers.get("X-Correlation-ID")
    assert generated_cid is not None
    assert generated_cid.startswith("req_")


def test_log_usage_includes_correlation_id(monkeypatch):
    captured_payloads = []

    def mock_post(url, headers=None, json=None, timeout=None):
        captured_payloads.append({"url": url, "headers": headers or {}, "json": json or {}})
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        return mock_resp

    monkeypatch.setattr("httpx.post", mock_post)

    # Set context correlation ID
    set_correlation_id("trace-xyz-789")

    dummy_resp = LLMResponse(text="Hello", model="llama-3.3-70b", provider="groq", tokens_in=5, tokens_out=10)
    log_usage("tutor", dummy_resp, latency_ms=120, status="ok", error=None)

    assert len(captured_payloads) == 1
    call = captured_payloads[0]
    payload = call["json"]
    headers = call["headers"]

    # Verify correlation ID is recorded in payload and request header
    assert payload.get("correlationId") == "trace-xyz-789"
    assert payload.get("correlation_id") == "trace-xyz-789"
    assert headers.get("X-Correlation-ID") == "trace-xyz-789"
    assert payload.get("feature") == "tutor"
    assert payload.get("provider") == "groq"
    assert payload.get("tokensIn") == 5
    assert payload.get("tokensOut") == 10
