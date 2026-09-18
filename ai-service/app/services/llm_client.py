from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
from dataclasses import dataclass
from typing import Any, Protocol

import httpx
from app.core.config import settings

log = logging.getLogger("ai.llm")


@dataclass
class LLMResponse:
    text: str
    model: str
    provider: str
    tokens_in: int = 0
    tokens_out: int = 0
    raw: Any = None


class TransientProviderError(RuntimeError):
    """Transient failure (429, 500, 502, 503, timeout, network) that triggers fallback and circuit breaker."""
    pass


class ClientProviderError(RuntimeError):
    """Client/auth/schema failure (400, 401, 403, 404) that fails immediately without fallback."""
    pass


class LLMProvider(Protocol):
    def generate(self, prompt: str, schema: dict | None = None) -> LLMResponse: ...


from app.services.provider_manager import provider_manager
from app.services.cache_service import cache_service


class GeminiProvider:
    MODELS = [
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-2.5-flash",
        "gemini-flash-latest",
        "gemini-pro-latest",
    ]

    def _get_models_to_try(self, active_model: str) -> list[str]:
        candidates = [active_model] if active_model in self.MODELS else [self.MODELS[0]]
        for m in self.MODELS:
            if m not in candidates and not provider_manager.is_model_disabled(m):
                candidates.append(m)
        return candidates

    def generate(self, prompt: str, schema: dict | bool | None = None) -> LLMResponse:
        key, active_model, is_active = provider_manager.get_active_credentials("GEMINI")
        if not key or not is_active:
            raise RuntimeError("Gemini is not configured or is inactive")

        if provider_manager.is_in_cooldown("gemini"):
            raise RuntimeError("Gemini is currently in rate-limit cooldown")

        models_to_try = self._get_models_to_try(active_model)
        headers = {
            "x-goog-api-key": key,
            "Content-Type": "application/json",
        }
        body = {"contents": [{"parts": [{"text": prompt}]}]}
        if schema:
            body["generationConfig"] = {
                "response_mime_type": "application/json",
            }

        last_error = None
        for model in models_to_try:
            if provider_manager.is_in_cooldown(f"gemini:{model}"):
                continue

            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            try:
                r = httpx.post(url, headers=headers, json=body, timeout=30)
                if r.status_code == 200:
                    data = r.json()
                    text = data["candidates"][0]["content"]["parts"][0]["text"]
                    usage = data.get("usageMetadata", {})
                    return LLMResponse(
                        text=text,
                        model=model,
                        provider="gemini",
                        tokens_in=int(usage.get("promptTokenCount") or 0),
                        tokens_out=int(usage.get("candidatesTokenCount") or 0),
                        raw=data,
                    )
                elif r.status_code in (401, 403):
                    provider_manager.mark_provider_status("GEMINI", "ERROR", f"API key rejected or unauthorized (HTTP {r.status_code})")
                    raise ClientProviderError(f"Gemini API key unauthorized (HTTP {r.status_code})")
                elif r.status_code == 400:
                    log.warning("Gemini model %s returned 400 bad request: %s", model, r.text[:200])
                    raise ClientProviderError(f"Gemini bad request (HTTP 400): {r.text[:200]}")
                elif r.status_code == 404:
                    provider_manager.disable_model(model)
                    log.warning("Gemini model %s not found (404), disabled for session", model)
                    continue
                elif r.status_code == 429:
                    retry_after = float(r.headers.get("retry-after", 60))
                    provider_manager.set_cooldown(f"gemini:{model}", retry_after)
                    provider_manager.set_cooldown("gemini", min(30.0, retry_after))
                    provider_manager.mark_provider_status("GEMINI", "RATE_LIMITED", "Rate limit reached")
                    raise TransientProviderError(f"Gemini model {model} rate-limited (HTTP 429)")
                elif r.status_code in (500, 502, 503):
                    provider_manager.set_cooldown(f"gemini:{model}", 20.0)
                    provider_manager.set_cooldown("gemini", 10.0)
                    provider_manager.mark_provider_status("GEMINI", "RATE_LIMITED", f"Model server error ({r.status_code})")
                    raise TransientProviderError(f"Gemini model {model} server error (HTTP {r.status_code})")
                elif r.status_code >= 400:
                    raise TransientProviderError(f"Gemini HTTP {r.status_code} error: {r.text[:200]}")
            except (ClientProviderError, TransientProviderError):
                raise
            except (httpx.TimeoutException, httpx.NetworkError, httpx.ConnectError) as ex:
                last_error = ex
                log.warning("Gemini model %s network/timeout error: %s", model, ex)
                raise TransientProviderError(f"Gemini network/timeout error: {ex}") from ex
            except Exception as ex:
                last_error = ex
                log.warning("Gemini model %s call failed: %s", model, ex)
                continue
        raise TransientProviderError(f"All Gemini models failed: {last_error}")

    def generate_stream(self, prompt: str):
        key, active_model, is_active = provider_manager.get_active_credentials("GEMINI")
        if not key or not is_active:
            raise RuntimeError("Gemini is not configured or is inactive")

        if provider_manager.is_in_cooldown("gemini"):
            raise RuntimeError("Gemini is currently in rate-limit cooldown")

        models_to_try = self._get_models_to_try(active_model)
        headers = {
            "x-goog-api-key": key,
            "Content-Type": "application/json",
        }
        body = {"contents": [{"parts": [{"text": prompt}]}]}

        last_error = None
        for model in models_to_try:
            if provider_manager.is_in_cooldown(f"gemini:{model}"):
                continue

            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent"
            try:
                with httpx.stream("POST", url, headers=headers, params={"alt": "sse"}, json=body, timeout=45) as r:
                    if r.status_code in (401, 403):
                        provider_manager.mark_provider_status("GEMINI", "ERROR", f"API key rejected or unauthorized (HTTP {r.status_code})")
                        raise ClientProviderError(f"Gemini API key unauthorized (HTTP {r.status_code})")
                    if r.status_code == 400:
                        raise ClientProviderError(f"Gemini stream bad request (HTTP 400)")
                    if r.status_code == 429:
                        provider_manager.set_cooldown(f"gemini:{model}", 60.0)
                        provider_manager.set_cooldown("gemini", 30.0)
                        raise TransientProviderError(f"Gemini stream rate-limited (HTTP 429)")
                    if r.status_code in (500, 502, 503):
                        provider_manager.set_cooldown(f"gemini:{model}", 20.0)
                        raise TransientProviderError(f"Gemini stream server error (HTTP {r.status_code})")
                    if r.status_code == 404:
                        provider_manager.disable_model(model)
                        continue
                    r.raise_for_status()
                    for line in r.iter_lines():
                        if line.startswith("data: "):
                            raw_json = line[6:].strip()
                            if not raw_json:
                                continue
                            try:
                                chunk = json.loads(raw_json)
                                candidates = chunk.get("candidates", [])
                                if candidates:
                                    parts = candidates[0].get("content", {}).get("parts", [])
                                    if parts and "text" in parts[0]:
                                        yield parts[0]["text"]
                            except Exception:
                                continue
                    return
            except (ClientProviderError, TransientProviderError):
                raise
            except (httpx.TimeoutException, httpx.NetworkError, httpx.ConnectError) as ex:
                last_error = ex
                raise TransientProviderError(f"Gemini stream timeout/network error: {ex}") from ex
            except Exception as ex:
                last_error = ex
                log.warning("Gemini stream model %s failed: %s", model, ex)
                continue
        raise TransientProviderError(f"All Gemini stream models failed: {last_error}")


class GroqProvider:
    MODELS = [
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "mixtral-8x7b-32768",
        "gemma2-9b-it",
        "deepseek-r1-distill-llama-70b",
    ]

    def _get_models_to_try(self, active_model: str) -> list[str]:
        candidates = [active_model] if active_model in self.MODELS else [self.MODELS[0]]
        for m in self.MODELS:
            if m not in candidates and not provider_manager.is_model_disabled(m):
                candidates.append(m)
        return candidates

    def generate(self, prompt: str, schema: dict | bool | None = None) -> LLMResponse:
        key, active_model, is_active = provider_manager.get_active_credentials("GROQ")
        if not key or not is_active:
            raise RuntimeError("Groq is not configured or is inactive")

        if provider_manager.is_in_cooldown("groq"):
            raise RuntimeError("Groq is currently in rate-limit cooldown")

        models_to_try = self._get_models_to_try(active_model)
        headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}

        last_error = None
        for model in models_to_try:
            if provider_manager.is_in_cooldown(f"groq:{model}"):
                continue

            body = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
            }
            if schema:
                body["response_format"] = {"type": "json_object"}

            try:
                r = httpx.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=body, timeout=30)
                if r.status_code == 200:
                    data = r.json()
                    text = data["choices"][0]["message"]["content"]
                    usage = data.get("usage", {})
                    return LLMResponse(
                        text=text,
                        model=model,
                        provider="groq",
                        tokens_in=int(usage.get("prompt_tokens") or 0),
                        tokens_out=int(usage.get("completion_tokens") or 0),
                        raw=data,
                    )
                elif r.status_code in (401, 403):
                    provider_manager.mark_provider_status("GROQ", "ERROR", f"API key rejected or unauthorized (HTTP {r.status_code})")
                    raise ClientProviderError(f"Groq API key unauthorized (HTTP {r.status_code})")
                elif r.status_code == 400:
                    log.warning("Groq model %s returned 400 bad request: %s", model, r.text[:200])
                    raise ClientProviderError(f"Groq bad request (HTTP 400): {r.text[:200]}")
                elif r.status_code == 404:
                    provider_manager.disable_model(model)
                    log.warning("Groq model %s not found (404), disabled for session", model)
                    continue
                elif r.status_code == 429:
                    retry_after = float(r.headers.get("retry-after", 60))
                    provider_manager.set_cooldown(f"groq:{model}", retry_after)
                    provider_manager.set_cooldown("groq", min(30.0, retry_after))
                    provider_manager.mark_provider_status("GROQ", "RATE_LIMITED", "Rate limit reached")
                    raise TransientProviderError(f"Groq model {model} rate-limited (HTTP 429)")
                elif r.status_code in (500, 502, 503):
                    provider_manager.set_cooldown(f"groq:{model}", 20.0)
                    provider_manager.set_cooldown("groq", 10.0)
                    provider_manager.mark_provider_status("GROQ", "RATE_LIMITED", f"Model overloaded/server error ({r.status_code})")
                    raise TransientProviderError(f"Groq model {model} server error (HTTP {r.status_code})")
                elif r.status_code >= 400:
                    raise TransientProviderError(f"Groq HTTP {r.status_code} error: {r.text[:200]}")
            except (ClientProviderError, TransientProviderError):
                raise
            except (httpx.TimeoutException, httpx.NetworkError, httpx.ConnectError) as ex:
                last_error = ex
                log.warning("Groq model %s network/timeout error: %s", model, ex)
                raise TransientProviderError(f"Groq network/timeout error: {ex}") from ex
            except Exception as ex:
                last_error = ex
                log.warning("Groq model %s failed: %s", model, ex)
                continue
        raise TransientProviderError(f"All Groq models failed: {last_error}")

    def generate_stream(self, prompt: str):
        key, active_model, is_active = provider_manager.get_active_credentials("GROQ")
        if not key or not is_active:
            raise RuntimeError("Groq is not configured or is inactive")

        if provider_manager.is_in_cooldown("groq"):
            raise TransientProviderError("Groq is currently in rate-limit cooldown")

        models_to_try = self._get_models_to_try(active_model)
        headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}

        last_error = None
        for model in models_to_try:
            if provider_manager.is_in_cooldown(f"groq:{model}"):
                continue

            body = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": True,
            }
            try:
                with httpx.stream("POST", "https://api.groq.com/openai/v1/chat/completions", headers=headers, json=body, timeout=45) as r:
                    if r.status_code in (401, 403):
                        provider_manager.mark_provider_status("GROQ", "ERROR", f"API key rejected or unauthorized (HTTP {r.status_code})")
                        raise ClientProviderError(f"Groq API key unauthorized (HTTP {r.status_code})")
                    if r.status_code == 400:
                        raise ClientProviderError(f"Groq stream bad request (HTTP 400)")
                    if r.status_code == 429:
                        provider_manager.set_cooldown(f"groq:{model}", 60.0)
                        provider_manager.set_cooldown("groq", 30.0)
                        raise TransientProviderError(f"Groq stream rate-limited (HTTP 429)")
                    if r.status_code in (500, 502, 503):
                        provider_manager.set_cooldown(f"groq:{model}", 20.0)
                        raise TransientProviderError(f"Groq stream server error (HTTP {r.status_code})")
                    if r.status_code == 404:
                        provider_manager.disable_model(model)
                        continue
                    r.raise_for_status()
                    for line in r.iter_lines():
                        if line.startswith("data: "):
                            raw = line[6:].strip()
                            if raw == "[DONE]":
                                break
                            if not raw:
                                continue
                            try:
                                chunk = json.loads(raw)
                                delta = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                                if delta:
                                    yield delta
                            except Exception:
                                continue
                    return
            except (ClientProviderError, TransientProviderError):
                raise
            except (httpx.TimeoutException, httpx.NetworkError, httpx.ConnectError) as ex:
                last_error = ex
                raise TransientProviderError(f"Groq stream timeout/network error: {ex}") from ex
            except Exception as ex:
                last_error = ex
                log.warning("Groq stream model %s failed: %s", model, ex)
                continue
        raise TransientProviderError(f"All Groq stream models failed: {last_error}")


class HeuristicProvider:
    """Offline/dev fallback so the prototype produces realistic output if APIs are down."""

    def generate(self, prompt: str, schema: dict | bool | None = None) -> LLMResponse:
        text = heuristic_complete(prompt)
        return LLMResponse(text=text, model="heuristic-local", provider="heuristic", tokens_in=len(prompt.split()), tokens_out=len(text.split()))

    def generate_stream(self, prompt: str):
        text = heuristic_complete(prompt)
        words = text.split(" ")
        for i, w in enumerate(words):
            yield w + (" " if i < len(words) - 1 else "")


def _tag(prompt: str, name: str) -> str:
    start = prompt.find(f"<{name}>")
    end = prompt.find(f"</{name}>")
    if start < 0 or end < 0:
        return ""
    return prompt[start + len(name) + 2 : end].strip()


def _sentences(text: str) -> list[str]:
    cleaned = re.sub(r"\[chunk\s+\d+[^\]]*\]|\[page\s+\d+[^\]]*\]", "", text)
    parts = [p.strip() for p in re.split(r"(?<=[.!?])\s+", cleaned) if p.strip()]
    return [p for p in parts if len(p) > 25 and not p.startswith("http")]


def heuristic_complete(prompt: str) -> str:
    lower = prompt.lower()
    material = _tag(prompt, "retrieved-material") or _tag(prompt, "material-sample")
    if material.lower() == "none":
        material = ""
    question = _tag(prompt, "user-question")

    if "generate" in lower and "question" in lower:
        preferred_open = "preferred type: open" in lower
        sents = _sentences(material)
        concept = "Uploaded Material"
        c_match = re.search(r'about\s+"([^"]+)"', prompt)
        if c_match:
            concept = c_match.group(1)

        fact = sents[0] if sents else (material[:180].strip() if material else f"Key principles of {concept}")
        short = fact[:140].rstrip(".")
        if preferred_open:
            return json.dumps({
                "type": "OPEN",
                "question": f"Based on your uploaded PDF, explain how this applies to {concept}: '{short}'",
                "options": None,
                "correctAnswer": short,
                "concept": concept,
            })

        distractors = []
        if len(sents) >= 4:
            distractors = [sents[1][:100], sents[2][:100], sents[3][:100]]
        else:
            distractors = [
                f"It is superseded by secondary considerations in {concept}",
                f"It only holds true under constrained external conditions",
                f"It is an alternative hypothesis not verified by the document",
            ]
        options = [short] + distractors[:3]
        return json.dumps({
            "type": "MCQ",
            "question": f"According to the uploaded material on {concept}, which statement is accurate?",
            "options": options,
            "correctAnswer": short,
            "concept": concept,
        })

    if "evaluate" in lower or "rubric" in lower:
        return json.dumps({
            "score": 0.75,
            "understanding": 0.8,
            "accuracy": 0.7,
            "relevance": 0.85,
            "understood": ["Demonstrated understanding of core concept from the notes"],
            "missing": ["Could cite more specific terms or steps mentioned in the material"],
            "feedback": "Strong answer that connects to the notes. To get full marks, expand on specific definitions."
        })

    if "recommend" in lower:
        return json.dumps({
            "text": "Review your weaker concepts from the notes, then take a short 5-question quiz to reinforce understanding.",
            "reason": "Based on recent quiz assessments and learning history."
        })

    if "extract" in lower and "concept" in lower:
        words = [w for w in re.findall(r"\b[A-Z][a-zA-Z]{3,}\b", material) if w.lower() not in {"this", "that", "from", "with", "page", "chunk", "data"}]
        names = []
        for w in words:
            if w not in names:
                names.append(w)
            if len(names) >= 5:
                break
        if not names:
            names = ["Overview", "Core Principles", "Applications"]
        return json.dumps({"concepts": [{"name": n, "description": f"Key concept '{n}' extracted from the uploaded PDF"} for n in names]})

    # Tutor response
    sents = _sentences(material)
    if not sents:
        return json.dumps({
            "answer": "I don't have enough specific evidence in your uploaded materials to answer that reliably. Please try asking about a topic covered in your PDF.",
            "citations": [],
            "confidence": 0.15,
            "evidenceStatus": "insufficient",
        })

    summary_text = " ".join(sents[:3])
    q = question or "your question"
    page_m = re.search(r"page\s+(\d+)", material, re.I)
    page = int(page_m.group(1)) if page_m else 1
    return json.dumps({
        "answer": f"Based on your uploaded notes, regarding {q}:\n\n{summary_text}",
        "citations": [{"source": "Uploaded material", "page": page, "quote": sents[0][:160]}],
        "confidence": 0.8,
        "evidenceStatus": "grounded",
    })


class LLMClient:
    def _active_provider_chain(self, feature: str = "tutor") -> list[str]:
        """Delegate task-specific provider selection and circuit breaker fallback to ProviderManager."""
        return provider_manager.get_provider_chain_for_task(feature)

    def _provider(self, name: str) -> LLMProvider:
        if name == "gemini":
            return GeminiProvider()
        if name == "groq":
            return GroqProvider()
        return HeuristicProvider()

    def generate(self, prompt: str, feature: str = "tutor", schema: dict | None = None) -> LLMResponse:
        chain = self._active_provider_chain(feature)
        primary_name = chain[0] if chain else "none"
        _, primary_model, _ = provider_manager.get_active_credentials(primary_name)

        # Check cache first for instant sub-millisecond response (provider/model aware)
        cached = cache_service.get_llm(feature, primary_name, primary_model, prompt, schema=bool(schema))
        if cached and isinstance(cached, dict) and "text" in cached:
            return LLMResponse(
                text=cached["text"],
                model=cached.get("model", primary_model) + " (cached)",
                provider=cached.get("provider", primary_name),
                tokens_in=0,
                tokens_out=0,
                raw=cached.get("raw"),
            )

        started = time.time()
        last_error = None

        for idx, name in enumerate(chain):
            try:
                provider = self._provider(name)
                resp = provider.generate(prompt, schema)
                latency = int((time.time() - started) * 1000)
                fallback_used = bool(idx > 0 and name != primary_name)

                # Record successful attempt in circuit breaker
                provider_manager.record_provider_success(name)
                log_usage(feature, resp, latency, "ok", None, fallback_used=fallback_used)

                # Store successful generation in cache with provider & model
                if resp and resp.text:
                    cache_service.set_llm(
                        feature,
                        resp.provider,
                        resp.model,
                        prompt,
                        bool(schema),
                        {
                            "text": resp.text,
                            "model": resp.model,
                            "provider": resp.provider,
                            "raw": resp.raw,
                        },
                        ttl_sec=3600.0,
                    )

                return resp
            except ClientProviderError as ex:
                # 400, 401, 403, 404: Client/auth error. Do NOT count toward breaker, do NOT fallback.
                provider_manager.record_provider_failure(name, is_transient=False)
                latency = int((time.time() - started) * 1000)
                log.error("Provider %s client error on %s (no fallback): %s", name, feature, ex)
                log_usage(feature, LLMResponse(text="", model=name, provider=name), latency, "error", str(ex))
                raise
            except (TransientProviderError, Exception) as ex:
                # 429, 500, 502, 503, timeout: Transient failure. Counts toward breaker and triggers fallback.
                provider_manager.record_provider_failure(name, is_transient=True)
                last_error = ex
                log.warning("Provider %s transient failure on %s (falling back): %s", name, feature, ex)
                continue

        latency = int((time.time() - started) * 1000)
        log_usage(feature, LLMResponse(text="", model="none", provider="none"), latency, "error", str(last_error))
        raise RuntimeError(f"All LLM providers failed for task '{feature}': {last_error}")

    def generate_stream(self, prompt: str, feature: str = "tutor"):
        started = time.time()
        chain = self._active_provider_chain(feature)
        primary_name = chain[0] if chain else "none"

        for idx, name in enumerate(chain):
            try:
                provider = self._provider(name)
                total_text = []
                for chunk in provider.generate_stream(prompt):
                    total_text.append(chunk)
                    yield chunk
                latency = int((time.time() - started) * 1000)
                full = "".join(total_text)
                resp = LLMResponse(
                    text=full,
                    model=name,
                    provider=name,
                    tokens_in=len(prompt.split()),
                    tokens_out=len(full.split()),
                )
                fallback_used = bool(idx > 0 and name != primary_name)

                # Record successful attempt in circuit breaker
                provider_manager.record_provider_success(name)
                log_usage(feature, resp, latency, "ok", None, fallback_used=fallback_used)
                return
            except ClientProviderError as ex:
                provider_manager.record_provider_failure(name, is_transient=False)
                latency = int((time.time() - started) * 1000)
                log.error("Stream provider %s client error (no fallback): %s", name, ex)
                log_usage(feature, LLMResponse(text="", model=name, provider=name), latency, "error", str(ex))
                raise
            except (TransientProviderError, Exception) as ex:
                provider_manager.record_provider_failure(name, is_transient=True)
                log.warning("Stream provider %s transient failure (falling back): %s", name, ex)
                continue

        latency = int((time.time() - started) * 1000)
        log_usage(feature, LLMResponse(text="", model="none", provider="none"), latency, "error", "All streaming failed")
        yield "I am currently unable to stream the response. Please check your network or try again."


def log_usage(
    feature: str,
    resp: LLMResponse,
    latency_ms: int,
    status: str,
    error: str | None,
    fallback_used: bool = False,
    correlation_id: str | None = None,
):
    from app.core.context import get_correlation_id

    cid = correlation_id or get_correlation_id() or ""
    payload = {
        "correlationId": cid,
        "correlation_id": cid,
        "feature": feature,
        "model": resp.model,
        "provider": resp.provider,
        "tokensIn": resp.tokens_in,
        "tokensOut": resp.tokens_out,
        "latencyMs": latency_ms,
        "costEstimate": estimate_cost(resp),
        "status": status,
        "errorMsg": error,
        "fallbackUsed": fallback_used,
    }
    try:
        httpx.post(
            f"{settings.spring_internal_url}/api/internal/ai-usage",
            headers={
                "X-Internal-Secret": settings.internal_service_secret,
                "X-Correlation-ID": cid,
            },
            json=payload,
            timeout=5,
        )
    except Exception:
        try:
            from app.core.db import db
            from datetime import datetime, timezone
            payload["createdAt"] = datetime.now(timezone.utc)
            db()["ai_usage_logs"].insert_one(payload)
        except Exception:
            log.exception("failed to persist ai usage")


def estimate_cost(resp: LLMResponse) -> float:
    # Rough USD estimates for observability
    if resp.provider == "gemini":
        return (resp.tokens_in * 0.075 + resp.tokens_out * 0.30) / 1_000_000
    if resp.provider == "groq":
        return (resp.tokens_in * 0.05 + resp.tokens_out * 0.08) / 1_000_000
    return 0.0


_bge_model = None


def get_bge_model():
    global _bge_model
    if _bge_model is None:
        try:
            from fastembed import TextEmbedding
            _bge_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
        except Exception as ex:
            log.warning("fastembed BAAI model init error: %s", ex)
    return _bge_model


GEMINI_EMBED_MODELS = [
    "gemini-embedding-001",
    "gemini-embedding-2",
    "gemini-embedding-2-preview",
]


def embed_gemini(text: str, model_name: str | None = None) -> list[float] | None:
    """Call Google Gemini embedding API with secure header auth."""
    key, _, is_active = provider_manager.get_active_credentials("GEMINI")
    if not key or not is_active:
        return None
    models_to_try = [model_name] if model_name and "gemini" in model_name else GEMINI_EMBED_MODELS
    start = time.perf_counter()
    clean = text[:3000].strip() or "empty"
    headers = {
        "x-goog-api-key": key,
        "Content-Type": "application/json",
    }

    for m in models_to_try:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:embedContent"
            body = {
                "model": f"models/{m}",
                "content": {"parts": [{"text": clean}]},
                "outputDimensionality": settings.embedding_dim or 768,
            }
            r = httpx.post(url, headers=headers, json=body, timeout=10)
            latency = int((time.perf_counter() - start) * 1000)
            if r.status_code == 200:
                vals = r.json().get("embedding", {}).get("values", [])
                if vals:
                    norm = sum(x * x for x in vals) ** 0.5 or 1.0
                    norm_vec = [float(x / norm) for x in vals]
                    log_usage(
                        "embedding",
                        LLMResponse(text="", model=m, provider="gemini", tokens_in=len(clean.split()), tokens_out=0),
                        latency,
                        "ok",
                        None,
                    )
                    return norm_vec
        except Exception as ex:
            log.debug("gemini embedding call failed for %s: %s", m, ex)
    return None


def embed_bge(text: str) -> list[float] | None:
    """Call local BAAI/bge-small-en-v1.5 embedding via fastembed ONNX."""
    model = get_bge_model()
    if not model:
        return None
    start = time.perf_counter()
    try:
        clean = text[:3000].strip() or "empty"
        embeddings = list(model.embed([clean]))
        latency = int((time.perf_counter() - start) * 1000)
        if embeddings:
            vals = list(embeddings[0])
            norm = sum(x * x for x in vals) ** 0.5 or 1.0
            norm_vec = [float(x / norm) for x in vals]
            log_usage(
                "embedding",
                LLMResponse(text="", model="BAAI/bge-small-en-v1.5", provider="local", tokens_in=len(clean.split()), tokens_out=0),
                latency,
                "ok",
                None,
            )
            return norm_vec
    except Exception as ex:
        log.debug("bge embedding failed: %s", ex)
    return None


def embed_text(text: str, model_preference: str = "auto") -> list[float]:
    """Semantic embedding supporting BAAI/bge-small-en-v1.5 (primary) with caching and fallbacks."""
    clean = text[:3000].strip() or "empty"

    # 0. Check cache
    cached = cache_service.get_embedding(clean)
    if cached:
        return cached

    # 1. Dedicated BAAI/bge-small-en-v1.5 local ONNX embedding (primary)
    if model_preference in ("auto", "bge", "baai", "local"):
        vec = embed_bge(clean)
        if vec:
            cache_service.set_embedding(clean, vec)
            return vec

    # 2. Remote Gemini embedding if explicitly requested with 'gemini'
    if "gemini" in model_preference:
        vec = embed_gemini(clean, model_name=model_preference)
        if vec:
            cache_service.set_embedding(clean, vec)
            return vec

    # 3. If BAAI wasn't tried yet, try BAAI (local ONNX, 0 API calls)
    vec = embed_bge(clean)
    if vec:
        cache_service.set_embedding(clean, vec)
        return vec

    # 4. Only try Gemini if explicitly configured/preferred
    if model_preference == "gemini" and settings.gemini_api_key:
        vec = embed_gemini(clean)
        if vec:
            cache_service.set_embedding(clean, vec)
            return vec

    # 5. Deterministic local n-gram hash vector fallback (0 API calls, 384 dimensions)
    dim = settings.embedding_dim or 384
    vec = [0.0] * dim
    tokens = re.findall(r"\b[a-z0-9]{2,}\b", clean.lower())
    for tok in tokens:
        h = int(hashlib.sha256(tok.encode()).hexdigest(), 16)
        vec[h % dim] += 1.0
        for i in range(len(tok) - 1):
            bg = tok[i : i + 2]
            h_bg = int(hashlib.md5(bg.encode()).hexdigest(), 16)
            vec[(h_bg) % dim] += 0.35
    norm = sum(x * x for x in vec) ** 0.5 or 1.0
    res = [x / norm for x in vec]
    cache_service.set_embedding(clean, res)
    return res


def embed_texts(texts: list[str], model_preference: str = "auto") -> list[list[float]]:
    """Batch embed multiple text chunks in a single ONNX pass with multi-tier caching."""
    if not texts:
        return []

    results: list[list[float] | None] = [None] * len(texts)
    missing_indices: list[int] = []
    missing_texts: list[str] = []

    for i, t in enumerate(texts):
        clean = t[:3000].strip() or "empty"
        cached = cache_service.get_embedding(clean)
        if cached:
            results[i] = cached
        else:
            missing_indices.append(i)
            missing_texts.append(clean)

    if missing_texts:
        model = get_bge_model()
        if model:
            try:
                embeddings = list(model.embed(missing_texts))
                for idx, emb in zip(missing_indices, embeddings):
                    vals = list(emb)
                    norm = sum(x * x for x in vals) ** 0.5 or 1.0
                    norm_vec = [float(x / norm) for x in vals]
                    results[idx] = norm_vec
                    cache_service.set_embedding(texts[idx], norm_vec)
            except Exception as ex:
                log.warning("batch bge embed failed, falling back to individual embed: %s", ex)
                for idx in missing_indices:
                    results[idx] = embed_text(texts[idx], model_preference)
        else:
            for idx in missing_indices:
                results[idx] = embed_text(texts[idx], model_preference)

    # Fill any remaining None with embed_text fallback
    final_results = []
    for i, r in enumerate(results):
        if r is None:
            r = embed_text(texts[i], model_preference)
        final_results.append(r)
    return final_results


def cosine(a: list[float], b: list[float]) -> float:
    if not a or not b:
        return 0.0
    n = min(len(a), len(b))
    if n == 0:
        return 0.0
    # Normalize lengths if dimensionality differs
    sub_a = a[:n]
    sub_b = b[:n]
    norm_a = sum(x * x for x in sub_a) ** 0.5 or 1.0
    norm_b = sum(x * x for x in sub_b) ** 0.5 or 1.0
    return sum((sub_a[i] / norm_a) * (sub_b[i] / norm_b) for i in range(n))


llm = LLMClient()
