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


class LLMProvider(Protocol):
    def generate(self, prompt: str, schema: dict | None = None) -> LLMResponse: ...


from app.services.provider_manager import provider_manager


class GeminiProvider:
    MODELS = [
        "gemini-3.6-flash",
        "gemini-3.7-flash",
        "gemini-3.8-flash",
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-2.5-pro",
        "gemini-flash-latest",
        "gemini-pro-latest",
        "gemma-4-26b-a4b-it",
        "gemma-4-31b-it",
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
                r = httpx.post(url, headers=headers, json=body, timeout=45)
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
                    provider_manager.mark_provider_status("GEMINI", "ERROR", "API key rejected or unauthorized")
                    raise RuntimeError(f"Gemini API key unauthorized (HTTP {r.status_code})")
                elif r.status_code == 429:
                    retry_after = float(r.headers.get("retry-after", 60))
                    provider_manager.set_cooldown(f"gemini:{model}", retry_after)
                    provider_manager.set_cooldown("gemini", min(30.0, retry_after))
                    provider_manager.mark_provider_status("GEMINI", "RATE_LIMITED", "Rate limit reached")
                    log.warning("Gemini model %s rate-limited (429), cooling down %.1fs", model, retry_after)
                    break  # Break to trigger fallback rather than spamming remaining models
                elif r.status_code == 404:
                    provider_manager.disable_model(model)
                    log.warning("Gemini model %s not found (404), disabled for session", model)
                    continue
                elif r.status_code == 400:
                    log.warning("Gemini model %s returned 400 bad request: %s", model, r.text[:200])
                    break
                elif r.status_code >= 500:
                    time.sleep(0.5)  # transient backoff
                    r_retry = httpx.post(url, headers=headers, json=body, timeout=45)
                    if r_retry.status_code == 200:
                        data = r_retry.json()
                        text = data["candidates"][0]["content"]["parts"][0]["text"]
                        usage = data.get("usageMetadata", {})
                        return LLMResponse(text=text, model=model, provider="gemini", tokens_in=int(usage.get("promptTokenCount") or 0), tokens_out=int(usage.get("candidatesTokenCount") or 0), raw=data)
                    last_error = f"HTTP {r_retry.status_code}"
            except Exception as ex:
                last_error = ex
                log.warning("Gemini model %s call failed: %s", model, ex)
                continue
        raise RuntimeError(f"All Gemini models failed: {last_error}")

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
                        provider_manager.mark_provider_status("GEMINI", "ERROR", "API key rejected or unauthorized")
                        break
                    if r.status_code == 429:
                        provider_manager.set_cooldown(f"gemini:{model}", 60.0)
                        provider_manager.set_cooldown("gemini", 30.0)
                        break
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
            except Exception as ex:
                last_error = ex
                log.warning("Gemini stream model %s failed: %s", model, ex)
                continue
        raise RuntimeError(f"All Gemini stream models failed: {last_error}")


class GroqProvider:
    MODELS = [
        "qwen/qwen3.8-27b",
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "groq/compound",
        "groq/compound-mini",
        "openai/gpt-oss-safeguard-20b",
        "allam-2-7b",
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
                r = httpx.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=body, timeout=45)
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
                    provider_manager.mark_provider_status("GROQ", "ERROR", "API key rejected or unauthorized")
                    raise RuntimeError(f"Groq API key unauthorized (HTTP {r.status_code})")
                elif r.status_code == 429:
                    retry_after = float(r.headers.get("retry-after", 60))
                    provider_manager.set_cooldown(f"groq:{model}", retry_after)
                    provider_manager.set_cooldown("groq", min(30.0, retry_after))
                    provider_manager.mark_provider_status("GROQ", "RATE_LIMITED", "Rate limit reached")
                    log.warning("Groq model %s rate-limited (429), cooling down %.1fs", model, retry_after)
                    break
                elif r.status_code == 404:
                    provider_manager.disable_model(model)
                    log.warning("Groq model %s not found (404), disabled for session", model)
                    continue
                elif r.status_code == 400:
                    log.warning("Groq model %s returned 400 bad request: %s", model, r.text[:200])
                    break
                elif r.status_code >= 500:
                    time.sleep(0.5)
                    r_retry = httpx.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=body, timeout=45)
                    if r_retry.status_code == 200:
                        data = r_retry.json()
                        text = data["choices"][0]["message"]["content"]
                        usage = data.get("usage", {})
                        return LLMResponse(text=text, model=model, provider="groq", tokens_in=int(usage.get("prompt_tokens") or 0), tokens_out=int(usage.get("completion_tokens") or 0), raw=data)
                    last_error = f"HTTP {r_retry.status_code}"
            except Exception as ex:
                last_error = ex
                log.warning("Groq model %s failed: %s", model, ex)
                continue
        raise RuntimeError(f"All Groq models failed: {last_error}")

    def generate_stream(self, prompt: str):
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
                "stream": True,
            }
            try:
                with httpx.stream("POST", "https://api.groq.com/openai/v1/chat/completions", headers=headers, json=body, timeout=45) as r:
                    if r.status_code in (401, 403):
                        provider_manager.mark_provider_status("GROQ", "ERROR", "API key rejected or unauthorized")
                        break
                    if r.status_code == 429:
                        provider_manager.set_cooldown(f"groq:{model}", 60.0)
                        provider_manager.set_cooldown("groq", 30.0)
                        break
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
            except Exception as ex:
                last_error = ex
                log.warning("Groq stream model %s failed: %s", model, ex)
                continue
        raise RuntimeError(f"All Groq stream models failed: {last_error}")


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
    def _active_provider_chain(self) -> list[str]:
        chain = []
        _, _, gemini_active = provider_manager.get_active_credentials("GEMINI")
        _, _, groq_active = provider_manager.get_active_credentials("GROQ")

        primary = (settings.primary_provider or "gemini").lower()
        fallback = (settings.fallback_provider or "groq").lower()

        if primary == "gemini" and gemini_active:
            chain.append("gemini")
        elif primary == "groq" and groq_active:
            chain.append("groq")

        if fallback == "groq" and groq_active and "groq" not in chain:
            chain.append("groq")
        elif fallback == "gemini" and gemini_active and "gemini" not in chain:
            chain.append("gemini")

        # If any remote provider is active but wasn't in chain, add it
        if gemini_active and "gemini" not in chain:
            chain.append("gemini")
        if groq_active and "groq" not in chain:
            chain.append("groq")

        # Always append zero-failure heuristic fallback
        chain.append("heuristic")
        return chain

    def _provider(self, name: str) -> LLMProvider:
        if name == "gemini":
            return GeminiProvider()
        if name == "groq":
            return GroqProvider()
        return HeuristicProvider()

    def generate(self, prompt: str, feature: str, schema: dict | None = None) -> LLMResponse:
        started = time.time()
        last_error = None
        chain = self._active_provider_chain()
        primary_name = chain[0] if chain else "none"

        for idx, name in enumerate(chain):
            try:
                provider = self._provider(name)
                resp = provider.generate(prompt, schema)
                latency = int((time.time() - started) * 1000)
                fallback_used = bool(idx > 0 and name != primary_name)
                log_usage(feature, resp, latency, "ok", None, fallback_used=fallback_used)
                return resp
            except Exception as ex:
                last_error = ex
                log.warning("provider %s failed: %s", name, ex)
                continue
        latency = int((time.time() - started) * 1000)
        log_usage(feature, LLMResponse(text="", model="none", provider="none"), latency, "error", str(last_error))
        raise RuntimeError(f"All LLM providers failed: {last_error}")

    def generate_stream(self, prompt: str, feature: str = "tutor"):
        started = time.time()
        chain = self._active_provider_chain()
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
                log_usage(feature, resp, latency, "ok", None, fallback_used=fallback_used)
                return
            except Exception as ex:
                log.warning("stream provider %s failed: %s", name, ex)
                continue
        latency = int((time.time() - started) * 1000)
        log_usage(feature, LLMResponse(text="", model="none", provider="none"), latency, "error", "All streaming failed")
        yield "I am currently unable to stream the response. Please check your network or try again."


def log_usage(feature: str, resp: LLMResponse, latency_ms: int, status: str, error: str | None, fallback_used: bool = False):
    payload = {
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
            headers={"X-Internal-Secret": settings.internal_service_secret},
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
    """Semantic embedding supporting Gemini (001, 2) and BAAI/bge-small-en-v1.5 with fallback."""
    # 1. If explicitly requested Gemini model or auto with Gemini key available
    if "gemini" in model_preference or (model_preference == "auto" and settings.gemini_api_key):
        vec = embed_gemini(text, model_name=model_preference if "gemini" in model_preference else None)
        if vec:
            return vec

    # 2. Local high-speed BAAI/bge-small-en-v1.5 embedding
    vec = embed_bge(text)
    if vec:
        return vec

    # 3. If Gemini was not tried yet and key is present, try Gemini
    if settings.gemini_api_key:
        vec = embed_gemini(text)
        if vec:
            return vec

    # 4. Deterministic n-gram hash vector fallback
    dim = settings.embedding_dim or 768
    vec = [0.0] * dim
    tokens = re.findall(r"\b[a-z0-9]{2,}\b", text.lower())
    for tok in tokens:
        h = int(hashlib.sha256(tok.encode()).hexdigest(), 16)
        vec[h % dim] += 1.0
        for i in range(len(tok) - 1):
            bg = tok[i : i + 2]
            h_bg = int(hashlib.md5(bg.encode()).hexdigest(), 16)
            vec[(h_bg) % dim] += 0.35
    norm = sum(x * x for x in vec) ** 0.5 or 1.0
    return [x / norm for x in vec]


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
