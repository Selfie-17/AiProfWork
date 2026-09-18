from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
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


class RuntimeProviderManager:
    def __init__(self):
        self._cache: dict[str, dict[str, Any]] = {}
        self._last_loaded_at: float = 0.0
        self._cache_ttl: float = 60.0  # 60 seconds auto-refresh TTL
        self._cooldowns: dict[str, float] = {}  # key: "provider" or "provider:model" -> timestamp
        self._disabled_models: set[str] = set()

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
