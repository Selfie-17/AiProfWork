from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from enum import Enum
from typing import Any

import httpx
from app.core.config import settings
from app.core.crypto import decrypt_api_key, encrypt_api_key, mask_key
from app.core.db import db
from app.models.provider_config import ProviderConfigOut, ProviderTestOut

log = logging.getLogger("ai.provider_manager")

GEMINI_GENERATIVE_MODELS = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-pro-latest",
]

GROQ_GENERATIVE_MODELS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768",
    "gemma2-9b-it",
    "deepseek-r1-distill-llama-70b",
]

TASK_ROUTING: dict[str, str] = {
    "tutor": "groq",
    "quiz": "groq",
    "flashcards": "groq",
    "study_plan": "groq",
    "misconception": "groq",
    "eval": "gemini",
}


def normalize_task(feature: str) -> str:
    """Normalize runtime feature strings to canonical task names."""
    f = (feature or "").lower().strip()
    if "tutor" in f:
        return "tutor"
    if "quiz" in f:
        return "quiz"
    if "flashcard" in f:
        return "flashcards"
    if "study_plan" in f or "plan" in f:
        return "study_plan"
    if "mistake" in f or "misconception" in f:
        return "misconception"
    if "eval" in f:
        return "eval"
    return "tutor"


class CircuitState(str, Enum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"


_RECORD_FAILURE_LUA = """
local failures_key = KEYS[1]
local state_key = KEYS[2]
local opened_at_key = KEYS[3]

local now = tonumber(ARGV[1])
local cutoff = tonumber(ARGV[2])
local threshold = tonumber(ARGV[3])
local ttl = math.max(1, math.ceil(tonumber(ARGV[4])))
local member = ARGV[5]

redis.call('ZREMRANGEBYSCORE', failures_key, '-inf', cutoff)
redis.call('ZADD', failures_key, now, member)
redis.call('EXPIRE', failures_key, ttl)

local count = redis.call('ZCARD', failures_key)
if count >= threshold then
    redis.call('SET', state_key, 'OPEN')
    redis.call('SET', opened_at_key, tostring(now))
    return {1, count}
end
return {0, count}
"""


class CircuitBreaker:
    """
    Standard 3-state Circuit Breaker backed by Redis with atomic operations and local-memory fallback:
    - CLOSED: Normal operation. Records transient errors in a 60-second sliding window.
    - OPEN: Tripped when failure_threshold reached. Rejects requests for recovery_timeout (30s).
    - HALF_OPEN: Probe state testing if provider has recovered. Exclusive probe lock prevents herd probe.
    """

    def __init__(
        self,
        provider: str,
        failure_threshold: int = 5,
        failure_window: float = 60.0,
        recovery_timeout: float = 30.0,
    ):
        self.provider = provider.upper()
        self.failure_threshold = failure_threshold
        self.failure_window = failure_window
        self.recovery_timeout = recovery_timeout
        self._local_state = CircuitState.CLOSED
        self.failure_timestamps: list[float] = []
        self.last_state_change: float = time.time()

    def _get_redis(self):
        try:
            from app.services.cache_service import cache_service
            return cache_service._get_redis()
        except Exception:
            return None

    @property
    def state(self) -> CircuitState:
        r = self._get_redis()
        if r is not None:
            try:
                st = r.get(f"ai:circuit:{self.provider}:state")
                if st:
                    return CircuitState(st)
            except Exception:
                pass
        return self._local_state

    @state.setter
    def state(self, val: CircuitState):
        self._local_state = val
        r = self._get_redis()
        if r is not None:
            try:
                r.set(f"ai:circuit:{self.provider}:state", val.value)
            except Exception:
                pass

    def can_attempt(self) -> bool:
        now = time.time()
        r = self._get_redis()
        if r is not None:
            try:
                state_key = f"ai:circuit:{self.provider}:state"
                opened_at_key = f"ai:circuit:{self.provider}:opened_at"
                probe_lock_key = f"ai:circuit:{self.provider}:probe_lock"

                raw_state = r.get(state_key)
                current_state = raw_state if raw_state else CircuitState.CLOSED.value

                if current_state == CircuitState.CLOSED.value:
                    return True
                elif current_state == CircuitState.OPEN.value:
                    raw_opened = r.get(opened_at_key)
                    opened_at = float(raw_opened) if raw_opened else self.last_state_change
                    if now - opened_at >= self.recovery_timeout:
                        # Exclusively acquire probe lock to transition into HALF_OPEN (using millisecond precision)
                        ms = max(10, int(self.recovery_timeout * 1000))
                        lock_acquired = r.set(probe_lock_key, "probing", nx=True, px=ms)
                        if lock_acquired:
                            r.set(state_key, CircuitState.HALF_OPEN.value, px=ms)
                            log.info("CircuitBreaker[%s]: OPEN -> HALF_OPEN (acquired probe lock)", self.provider)
                            self._local_state = CircuitState.HALF_OPEN
                            self.last_state_change = now
                            return True
                        return False
                    return False
                elif current_state == CircuitState.HALF_OPEN.value:
                    # In HALF_OPEN, only the worker that holds the probe executes
                    return False
                return True
            except Exception as ex:
                log.warning("Redis error in CircuitBreaker[%s].can_attempt, using local fallback: %s", self.provider, ex)

        # Local in-memory fallback
        if self._local_state == CircuitState.CLOSED:
            return True
        elif self._local_state == CircuitState.OPEN:
            if now - self.last_state_change >= self.recovery_timeout:
                log.info("CircuitBreaker[%s]: OPEN -> HALF_OPEN (probing provider recovery)", self.provider)
                self._local_state = CircuitState.HALF_OPEN
                self.last_state_change = now
                return True
            return False
        elif self._local_state == CircuitState.HALF_OPEN:
            return True
        return True

    def record_success(self):
        r = self._get_redis()
        if r is not None:
            try:
                state_key = f"ai:circuit:{self.provider}:state"
                failures_key = f"ai:circuit:{self.provider}:failures"
                opened_at_key = f"ai:circuit:{self.provider}:opened_at"
                probe_lock_key = f"ai:circuit:{self.provider}:probe_lock"

                current_state = r.get(state_key)
                if current_state == CircuitState.HALF_OPEN.value:
                    log.info("CircuitBreaker[%s]: HALF_OPEN probe succeeded -> CLOSED", self.provider)
                r.set(state_key, CircuitState.CLOSED.value)
                r.delete(failures_key, opened_at_key, probe_lock_key)
            except Exception as ex:
                log.warning("Redis error in CircuitBreaker[%s].record_success: %s", self.provider, ex)

        if self._local_state == CircuitState.HALF_OPEN:
            log.info("CircuitBreaker[%s]: HALF_OPEN probe succeeded -> CLOSED", self.provider)
        self._local_state = CircuitState.CLOSED
        self.last_state_change = time.time()
        self.failure_timestamps.clear()

    def record_failure(self):
        now = time.time()
        r = self._get_redis()
        if r is not None:
            try:
                state_key = f"ai:circuit:{self.provider}:state"
                failures_key = f"ai:circuit:{self.provider}:failures"
                opened_at_key = f"ai:circuit:{self.provider}:opened_at"
                probe_lock_key = f"ai:circuit:{self.provider}:probe_lock"

                raw_state = r.get(state_key)
                current_state = raw_state if raw_state else CircuitState.CLOSED.value

                if current_state == CircuitState.HALF_OPEN.value:
                    log.warning(
                        "CircuitBreaker[%s]: HALF_OPEN probe failed -> returning to OPEN for %.1fs",
                        self.provider,
                        self.recovery_timeout,
                    )
                    r.set(state_key, CircuitState.OPEN.value)
                    r.set(opened_at_key, str(now))
                    r.delete(probe_lock_key)
                    self._local_state = CircuitState.OPEN
                    self.last_state_change = now
                    return

                cutoff = now - self.failure_window
                member = f"{now}:{time.perf_counter()}"
                ttl = int(self.failure_window * 2)

                res = r.eval(_RECORD_FAILURE_LUA, 3, failures_key, state_key, opened_at_key, now, cutoff, self.failure_threshold, ttl, member)
                tripped, count = res[0], res[1]
                if tripped == 1:
                    log.warning(
                        "CircuitBreaker[%s]: CLOSED -> OPEN (%d transient failures in %.1fs). Cooldown %.1fs",
                        self.provider,
                        count,
                        self.failure_window,
                        self.recovery_timeout,
                    )
                    self._local_state = CircuitState.OPEN
                    self.last_state_change = now
                return
            except Exception as ex:
                log.warning("Redis error in CircuitBreaker[%s].record_failure, using local fallback: %s", self.provider, ex)

        # Local in-memory fallback
        if self._local_state == CircuitState.HALF_OPEN:
            log.warning(
                "CircuitBreaker[%s]: HALF_OPEN probe failed -> returning to OPEN for %.1fs",
                self.provider,
                self.recovery_timeout,
            )
            self._local_state = CircuitState.OPEN
            self.last_state_change = now
            return

        cutoff = now - self.failure_window
        self.failure_timestamps = [t for t in self.failure_timestamps if t >= cutoff]
        self.failure_timestamps.append(now)

        if len(self.failure_timestamps) >= self.failure_threshold:
            log.warning(
                "CircuitBreaker[%s]: CLOSED -> OPEN (%d transient failures in %.1fs). Cooldown %.1fs",
                self.provider,
                len(self.failure_timestamps),
                self.failure_window,
                self.recovery_timeout,
            )
            self._local_state = CircuitState.OPEN
            self.last_state_change = now

    def reset(self):
        """Explicitly reset circuit breaker state to CLOSED and clear failure tracking."""
        self._local_state = CircuitState.CLOSED
        self.failure_timestamps.clear()
        self.last_state_change = time.time()
        r = self._get_redis()
        if r is not None:
            try:
                state_key = f"ai:circuit:{self.provider}:state"
                failures_key = f"ai:circuit:{self.provider}:failures"
                opened_at_key = f"ai:circuit:{self.provider}:opened_at"
                probe_lock_key = f"ai:circuit:{self.provider}:probe_lock"
                r.set(state_key, CircuitState.CLOSED.value)
                r.delete(failures_key, opened_at_key, probe_lock_key)
            except Exception as ex:
                log.warning("Redis error in CircuitBreaker[%s].reset: %s", self.provider, ex)

    def get_status(self) -> dict[str, Any]:
        r = self._get_redis()
        if r is not None:
            try:
                state_key = f"ai:circuit:{self.provider}:state"
                failures_key = f"ai:circuit:{self.provider}:failures"
                opened_at_key = f"ai:circuit:{self.provider}:opened_at"
                raw_st = r.get(state_key)
                st = raw_st if raw_st else CircuitState.CLOSED.value
                count = r.zcard(failures_key)
                opened_at = float(r.get(opened_at_key) or 0.0)
                return {
                    "state": st,
                    "failuresInWindow": count,
                    "threshold": self.failure_threshold,
                    "recoveryTimeoutSec": self.recovery_timeout,
                    "lastStateChange": opened_at if opened_at else self.last_state_change,
                    "backend": "redis",
                }
            except Exception:
                pass
        return {
            "state": self._local_state.value,
            "failuresInWindow": len(self.failure_timestamps),
            "threshold": self.failure_threshold,
            "recoveryTimeoutSec": self.recovery_timeout,
            "lastStateChange": self.last_state_change,
            "backend": "memory",
        }


class RuntimeProviderManager:
    def __init__(self):
        self._cache: dict[str, dict[str, Any]] = {}
        self._last_loaded_at: float = 0.0
        self._cache_ttl: float = 60.0  # 60 seconds auto-refresh TTL
        self._cooldowns: dict[str, float] = {}  # key: "provider" or "provider:model" -> timestamp
        self._disabled_models: set[str] = set()
        self._circuit_breakers: dict[str, CircuitBreaker] = {
            "GROQ": CircuitBreaker("GROQ", failure_threshold=5, failure_window=60.0, recovery_timeout=30.0),
            "GEMINI": CircuitBreaker("GEMINI", failure_threshold=5, failure_window=60.0, recovery_timeout=30.0),
        }

    def invalidate_cache(self):
        """Immediately purge cached runtime configurations."""
        self._cache.clear()
        self._last_loaded_at = 0.0
        log.info("Runtime provider cache invalidated")

    def _ensure_loaded(self):
        now = time.time()
        if self._cache and (now - self._last_loaded_at < self._cache_ttl):
            return

        try:
            configs = list(db()["ai_provider_configs"].find({}))
            loaded = {}
            for doc in configs:
                p = doc.get("provider", "").upper()
                enc_key = doc.get("encrypted_api_key", "")
                raw_key = decrypt_api_key(enc_key) if enc_key else ""
                loaded[p] = {
                    "provider": p,
                    "apiKey": raw_key,
                    "active": bool(doc.get("active", True)),
                    "selectedModel": doc.get("selectedModel", ""),
                    "status": doc.get("last_test_status", "CONNECTED" if raw_key else "UNCONFIGURED"),
                    "lastTestedAt": doc.get("last_tested_at"),
                    "lastError": doc.get("last_error_sanitized"),
                }

            # Fill defaults from environment variables if not present in DB
            if "GEMINI" not in loaded and settings.gemini_api_key:
                loaded["GEMINI"] = {
                    "provider": "GEMINI",
                    "apiKey": settings.gemini_api_key,
                    "active": True,
                    "selectedModel": "gemini-2.0-flash",
                    "status": "CONNECTED",
                    "lastTestedAt": None,
                    "lastError": None,
                }

            if "GROQ" not in loaded and settings.groq_api_key:
                loaded["GROQ"] = {
                    "provider": "GROQ",
                    "apiKey": settings.groq_api_key,
                    "active": True,
                    "selectedModel": "llama-3.3-70b-versatile",
                    "status": "CONNECTED",
                    "lastTestedAt": None,
                    "lastError": None,
                }

            self._cache = loaded
            self._last_loaded_at = now
        except Exception as ex:
            log.warning("Failed to load provider configs from database: %s", ex)

    def get_provider_info(self, provider: str) -> dict[str, Any]:
        self._ensure_loaded()
        p = provider.upper()
        default_model = "llama-3.3-70b-versatile" if p == "GROQ" else "gemini-2.0-flash"
        info = self._cache.get(p)
        if not info:
            return {
                "provider": p,
                "apiKey": "",
                "active": False,
                "selectedModel": default_model,
                "status": "UNCONFIGURED",
                "lastTestedAt": None,
                "lastError": None,
            }
        return info

    def get_active_credentials(self, provider: str) -> tuple[str, str, bool]:
        """Returns (apiKey, selectedModel, isActive)."""
        info = self.get_provider_info(provider)
        key = info.get("apiKey", "")
        model = info.get("selectedModel") or ("llama-3.3-70b-versatile" if provider.upper() == "GROQ" else "gemini-2.0-flash")
        active = bool(info.get("active", False) and key)
        return key, model, active

    def get_circuit_breaker(self, provider: str) -> CircuitBreaker:
        p = provider.upper()
        if p not in self._circuit_breakers:
            self._circuit_breakers[p] = CircuitBreaker(p, failure_threshold=5, failure_window=60.0, recovery_timeout=30.0)
        return self._circuit_breakers[p]

    def is_provider_available(self, provider: str) -> bool:
        """Check if provider has active credentials, is not in cooldown, and circuit breaker allows attempts."""
        p = provider.upper()
        _, _, is_active = self.get_active_credentials(p)
        if not is_active:
            return False
        if self.is_in_cooldown(provider.lower()):
            return False
        return self.get_circuit_breaker(p).can_attempt()

    def get_provider_chain_for_task(self, feature_or_task: str = "tutor") -> list[str]:
        """
        Determine resilient, task-tailored provider execution chain.
        Routes interactive tasks to Groq, evaluation to Gemini, with automatic circuit breaker fallback.
        """
        task = normalize_task(feature_or_task)
        preferred = TASK_ROUTING.get(task, (settings.primary_provider or "groq")).lower()
        fallback = "gemini" if preferred == "groq" else "groq"

        preferred_avail = self.is_provider_available(preferred)
        fallback_avail = self.is_provider_available(fallback)

        _, _, pref_configured = self.get_active_credentials(preferred)
        _, _, fall_configured = self.get_active_credentials(fallback)

        chain: list[str] = []

        if preferred_avail:
            chain.append(preferred)
            if fall_configured:
                chain.append(fallback)
        elif fallback_avail:
            # Circuit breaker tripped or cooldown on preferred: route directly to fallback
            chain.append(fallback)
            if pref_configured:
                chain.append(preferred)
        else:
            # Both degraded/cooldown: preserve configured order
            if pref_configured:
                chain.append(preferred)
            if fall_configured and fallback not in chain:
                chain.append(fallback)

        # Always append zero-failure fallback
        chain.append("heuristic")
        return chain

    def record_provider_success(self, provider: str):
        """Record successful call to reset circuit breaker and restore state."""
        p = provider.upper()
        self.get_circuit_breaker(p).record_success()

    def record_provider_failure(self, provider: str, is_transient: bool = True):
        """
        Record failure. Only transient failures (429, 500, 502, 503, timeout) trip the circuit breaker.
        Non-transient errors (400, 401, 403, 404, schema) do not penalize provider circuit breaker.
        """
        p = provider.upper()
        if is_transient:
            self.get_circuit_breaker(p).record_failure()
            cb_status = self.get_circuit_breaker(p).state
            if cb_status == CircuitState.OPEN:
                self.mark_provider_status(p, "RATE_LIMITED", f"Circuit Breaker OPEN: 5+ transient failures in 60s")

    def is_in_cooldown(self, target: str) -> bool:
        cd = self._cooldowns.get(target, 0.0)
        return time.time() < cd

    def set_cooldown(self, target: str, duration_sec: float = 60.0):
        self._cooldowns[target] = time.time() + duration_sec
        log.warning("Cooldown set for %s for %.1fs", target, duration_sec)

    def is_model_disabled(self, model: str) -> bool:
        return model in self._disabled_models

    def disable_model(self, model: str):
        self._disabled_models.add(model)
        log.warning("Disabled unavailable model: %s", model)

    def mark_provider_status(self, provider: str, status: str, error_msg: str | None = None):
        p = provider.upper()
        now = datetime.now(timezone.utc).isoformat()
        try:
            db()["ai_provider_configs"].update_one(
                {"provider": p},
                {"$set": {
                    "last_test_status": status,
                    "last_tested_at": now,
                    "last_error_sanitized": error_msg,
                    "updated_at": now,
                }},
                upsert=True,
            )
            if p in self._cache:
                self._cache[p]["status"] = status
                self._cache[p]["lastTestedAt"] = now
                self._cache[p]["lastError"] = error_msg
        except Exception as ex:
            log.warning("Failed to update provider status in DB: %s", ex)

    def get_public_config(self, provider: str) -> ProviderConfigOut:
        info = self.get_provider_info(provider)
        p = provider.upper()
        raw_key = info.get("apiKey", "")
        avail = GEMINI_GENERATIVE_MODELS if p == "GEMINI" else GROQ_GENERATIVE_MODELS
        default_model = "llama-3.3-70b-versatile" if p == "GROQ" else "gemini-2.0-flash"

        return ProviderConfigOut(
            provider=p,
            configured=bool(raw_key),
            active=bool(info.get("active", False) and raw_key),
            selectedModel=info.get("selectedModel") or default_model,
            maskedKey=mask_key(raw_key),
            status=info.get("status", "UNCONFIGURED"),
            lastTestedAt=str(info.get("lastTestedAt")) if info.get("lastTestedAt") else None,
            lastError=info.get("lastError"),
            availableModels=avail,
            circuitBreaker=self.get_circuit_breaker(p).get_status(),
        )

    def test_connection(self, provider: str, key_override: str | None = None, model_override: str | None = None) -> ProviderTestOut:
        """Ping the provider with a 1-token safe completion using headers."""
        p = provider.upper()
        info = self.get_provider_info(p)
        key = key_override.strip() if (key_override and key_override.strip()) else info.get("apiKey", "")
        if not key:
            return ProviderTestOut(
                provider=p,
                model=model_override or info.get("selectedModel", ""),
                success=False,
                latencyMs=0,
                message="No API key configured for this provider.",
                statusCode=400,
            )

        model = model_override or info.get("selectedModel") or ("llama-3.3-70b-versatile" if p == "GROQ" else "gemini-2.0-flash")
        start = time.perf_counter()

        try:
            if p == "GEMINI":
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
                headers = {
                    "x-goog-api-key": key,
                    "Content-Type": "application/json",
                }
                body = {
                    "contents": [{"parts": [{"text": "ping"}]}],
                    "generationConfig": {"maxOutputTokens": 2},
                }
                r = httpx.post(url, headers=headers, json=body, timeout=12)
                latency = int((time.perf_counter() - start) * 1000)

                if r.status_code == 200:
                    self.mark_provider_status(p, "CONNECTED", None)
                    return ProviderTestOut(
                        provider=p,
                        model=model,
                        success=True,
                        latencyMs=latency,
                        message="Connection successful.",
                        statusCode=200,
                    )
                if r.status_code in (401, 403):
                    msg = "API key rejected or unauthorized."
                    self.mark_provider_status(p, "ERROR", msg)
                    return ProviderTestOut(provider=p, model=model, success=False, latencyMs=latency, message=msg, statusCode=r.status_code)
                if r.status_code == 429:
                    msg = "Rate limit reached. Please retry after the provider's cooldown."
                    self.set_cooldown(f"gemini:{model}", 60.0)
                    self.mark_provider_status(p, "RATE_LIMITED", msg)
                    return ProviderTestOut(provider=p, model=model, success=False, latencyMs=latency, message=msg, statusCode=429)
                if r.status_code == 503:
                    msg = "Model overloaded (503). Retrying or cooling down."
                    self.set_cooldown(f"gemini:{model}", 20.0)
                    self.mark_provider_status(p, "RATE_LIMITED", msg)
                    return ProviderTestOut(provider=p, model=model, success=False, latencyMs=latency, message=msg, statusCode=503)
                if r.status_code == 404:
                    msg = f"Model '{model}' is not available for this API key."
                    return ProviderTestOut(provider=p, model=model, success=False, latencyMs=latency, message=msg, statusCode=404)

                err_msg = f"Provider returned HTTP {r.status_code}."
                self.mark_provider_status(p, "ERROR", err_msg)
                return ProviderTestOut(provider=p, model=model, success=False, latencyMs=latency, message=err_msg, statusCode=r.status_code)

            elif p == "GROQ":
                url = "https://api.groq.com/openai/v1/chat/completions"
                headers = {
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                }
                body = {
                    "model": model,
                    "messages": [{"role": "user", "content": "ping"}],
                    "max_tokens": 2,
                }
                r = httpx.post(url, headers=headers, json=body, timeout=12)
                latency = int((time.perf_counter() - start) * 1000)

                if r.status_code == 200:
                    self.mark_provider_status(p, "CONNECTED", None)
                    return ProviderTestOut(
                        provider=p,
                        model=model,
                        success=True,
                        latencyMs=latency,
                        message="Connection successful.",
                        statusCode=200,
                    )
                if r.status_code in (401, 403):
                    msg = "API key rejected or unauthorized."
                    self.mark_provider_status(p, "ERROR", msg)
                    return ProviderTestOut(provider=p, model=model, success=False, latencyMs=latency, message=msg, statusCode=r.status_code)
                if r.status_code == 429:
                    msg = "Rate limit reached. Please retry after the provider's cooldown."
                    self.set_cooldown(f"groq:{model}", 60.0)
                    self.mark_provider_status(p, "RATE_LIMITED", msg)
                    return ProviderTestOut(provider=p, model=model, success=False, latencyMs=latency, message=msg, statusCode=429)
                if r.status_code == 503:
                    msg = "Model overloaded (503). Retrying or cooling down."
                    self.set_cooldown(f"groq:{model}", 20.0)
                    self.mark_provider_status(p, "RATE_LIMITED", msg)
                    return ProviderTestOut(provider=p, model=model, success=False, latencyMs=latency, message=msg, statusCode=503)
                if r.status_code == 404:
                    msg = f"Model '{model}' is not found."
                    return ProviderTestOut(provider=p, model=model, success=False, latencyMs=latency, message=msg, statusCode=404)

                err_msg = f"Provider returned HTTP {r.status_code}."
                self.mark_provider_status(p, "ERROR", err_msg)
                return ProviderTestOut(provider=p, model=model, success=False, latencyMs=latency, message=err_msg, statusCode=r.status_code)

            return ProviderTestOut(provider=p, model=model, success=False, latencyMs=0, message=f"Unsupported provider {p}", statusCode=400)

        except httpx.TimeoutException:
            latency = int((time.perf_counter() - start) * 1000)
            return ProviderTestOut(provider=p, model=model, success=False, latencyMs=latency, message="Connection timed out.", statusCode=504)
        except Exception as ex:
            latency = int((time.perf_counter() - start) * 1000)
            log.warning("Test connection error for %s: %s", p, ex)
            return ProviderTestOut(provider=p, model=model, success=False, latencyMs=latency, message="Failed to connect to provider API.", statusCode=500)

    def save_provider_config(self, provider: str, api_key: str | None, selected_model: str | None, active: bool | None) -> ProviderConfigOut:
        p = provider.upper()
        now = datetime.now(timezone.utc).isoformat()
        current = self.get_provider_info(p)

        update_doc: dict[str, Any] = {"updated_at": now}

        if api_key is not None and api_key.strip():
            update_doc["encrypted_api_key"] = encrypt_api_key(api_key.strip())
            update_doc["last_test_status"] = "CONNECTED"  # reset status on new key
            update_doc["last_error_sanitized"] = None
            self.get_circuit_breaker(p).reset()
        if selected_model is not None and selected_model.strip():
            update_doc["selectedModel"] = selected_model.strip()
        if active is not None:
            update_doc["active"] = bool(active)

        db()["ai_provider_configs"].update_one(
            {"provider": p},
            {"$set": update_doc, "$setOnInsert": {"created_at": now, "provider": p}},
            upsert=True,
        )

        self.invalidate_cache()
        return self.get_public_config(p)

    def delete_provider_config(self, provider: str) -> bool:
        p = provider.upper()
        db()["ai_provider_configs"].delete_one({"provider": p})
        self.invalidate_cache()
        return True


provider_manager = RuntimeProviderManager()
