from __future__ import annotations

import hashlib
import json
import logging
import time
from collections import OrderedDict
from typing import Any

log = logging.getLogger("ai.cache")


class MemoryCache:
    """In-memory thread-safe LRU cache with optional TTL."""

    def __init__(self, max_items: int = 5000, default_ttl_sec: float = 3600.0):
        self._store: OrderedDict[str, tuple[Any, float]] = OrderedDict()
        self._max_items = max_items
        self._default_ttl = default_ttl_sec

    def get(self, key: str) -> Any | None:
        if key not in self._store:
            return None
        val, expiry = self._store[key]
        if expiry and time.time() > expiry:
            del self._store[key]
            return None
        self._store.move_to_end(key)
        return val

    def set(self, key: str, value: Any, ttl_sec: float | None = None) -> None:
        expiry = time.time() + (ttl_sec if ttl_sec is not None else self._default_ttl) if ttl_sec != 0 else 0.0
        if key in self._store:
            self._store.move_to_end(key)
        self._store[key] = (value, expiry)
        if len(self._store) > self._max_items:
            self._store.popitem(last=False)

    def delete(self, key: str) -> bool:
        if key in self._store:
            del self._store[key]
            return True
        return False

    def clear(self) -> None:
        self._store.clear()

    def invalidate_prefix(self, prefix: str) -> int:
        keys_to_del = [k for k in self._store if k.startswith(prefix)]
        for k in keys_to_del:
            del self._store[k]
        return len(keys_to_del)


class TieredCacheService:
    """Unified caching service combining fast memory cache and optional Redis."""

    def __init__(self):
        # 1. Embedding cache (text hash -> 384-dim vector, TTL: 24 hours, up to 10k items)
        self.embedding_cache = MemoryCache(max_items=10000, default_ttl_sec=86400.0)

        # 2. LLM response cache (prompt hash -> LLMResponse, TTL: 1 hour, up to 2k items)
        self.llm_cache = MemoryCache(max_items=2000, default_ttl_sec=3600.0)

        # 3. Project chunks corpus cache (project_id -> chunks list, TTL: 60 seconds)
        self.corpus_cache = MemoryCache(max_items=500, default_ttl_sec=60.0)

        # 4. Redis client handle (lazy)
        self._redis = None
        self._redis_checked = False

    def _get_redis(self):
        if not self._redis_checked:
            self._redis_checked = True
            try:
                import redis
                from app.core.config import settings
                if settings.redis_url:
                    r = redis.from_url(settings.redis_url, decode_responses=True, socket_timeout=1.5)
                    r.ping()
                    self._redis = r
                    log.info("Redis cache connected successfully (%s)", settings.redis_url)
            except Exception as ex:
                log.debug("Redis cache not available, using in-memory cache: %s", ex)
                self._redis = None
        return self._redis

    @staticmethod
    def hash_key(*parts: Any) -> str:
        s = ":".join(str(p) for p in parts)
        return hashlib.sha256(s.encode("utf-8")).hexdigest()

    def get_embedding(self, text: str) -> list[float] | None:
        key = self.hash_key("emb", text.strip())
        cached = self.embedding_cache.get(key)
        if cached is not None:
            return cached

        r = self._get_redis()
        if r:
            try:
                data = r.get(f"emb:{key}")
                if data:
                    vec = json.loads(data)
                    self.embedding_cache.set(key, vec, ttl_sec=86400.0)
                    return vec
            except Exception:
                pass
        return None

    def set_embedding(self, text: str, vector: list[float]) -> None:
        key = self.hash_key("emb", text.strip())
        self.embedding_cache.set(key, vector, ttl_sec=86400.0)
        r = self._get_redis()
        if r:
            try:
                r.setex(f"emb:{key}", 86400, json.dumps(vector))
            except Exception:
                pass

    def _llm_key(self, feature: str, provider: str, model: str, schema: bool, prompt: str) -> str:
        return self.hash_key(
            "llm",
            feature.lower().strip(),
            provider.lower().strip(),
            model.lower().strip(),
            str(bool(schema)),
            prompt.strip(),
        )

    def get_llm(
        self,
        feature: str,
        *args,
        provider: str = "any",
        model: str = "any",
        prompt: str = "",
        schema: bool = False,
        **kwargs,
    ) -> Any | None:
        """
        Provider and model-aware LLM cache lookup.
        Supports:
          get_llm(feature, provider, model, prompt, schema=False)
          get_llm(feature, prompt, schema=False)
          get_llm(feature, provider="groq", model="llama-3.3-70b-versatile", prompt="...", schema=False)
        """
        if len(args) >= 3:
            p = str(args[0])
            m = str(args[1])
            pr = str(args[2])
            s = bool(args[3]) if len(args) > 3 else schema
        elif len(args) in (1, 2):
            p = provider
            m = model
            pr = str(args[0])
            s = bool(args[1]) if len(args) == 2 else schema
        else:
            p = provider
            m = model
            pr = prompt
            s = schema

        key = self._llm_key(feature, p, m, s, pr)
        cached = self.llm_cache.get(key)
        if cached is not None:
            return cached

        r = self._get_redis()
        if r:
            try:
                data = r.get(f"llm:{key}")
                if data:
                    res = json.loads(data)
                    self.llm_cache.set(key, res, ttl_sec=3600.0)
                    return res
            except Exception:
                pass
        return None

    def set_llm(
        self,
        feature: str,
        *args,
        provider: str = "any",
        model: str = "any",
        prompt: str = "",
        schema: bool = False,
        response_dict: dict | None = None,
        ttl_sec: float = 3600.0,
        **kwargs,
    ) -> None:
        """
        Provider and model-aware LLM cache storage.
        Supports:
          set_llm(feature, provider, model, prompt, schema, response_dict, ttl_sec=3600.0)
          set_llm(feature, prompt, schema, response_dict, ttl_sec=3600.0)
          set_llm(feature, provider="groq", model="...", prompt="...", schema=False, response_dict={...})
        """
        if len(args) >= 5:
            p = str(args[0])
            m = str(args[1])
            pr = str(args[2])
            s = bool(args[3])
            data = args[4]
            if len(args) > 5 and isinstance(args[5], (int, float)):
                ttl_sec = float(args[5])
        elif len(args) >= 3 and isinstance(args[2], dict):
            p = provider
            m = model
            pr = str(args[0])
            s = bool(args[1])
            data = args[2]
            if len(args) > 3 and isinstance(args[3], (int, float)):
                ttl_sec = float(args[3])
        else:
            p = provider
            m = model
            pr = prompt
            s = schema
            data = response_dict or kwargs.get("response_dict") or {}

        key = self._llm_key(feature, p, m, s, pr)
        self.llm_cache.set(key, data, ttl_sec=ttl_sec)
        r = self._get_redis()
        if r:
            try:
                r.set(f"llm:{key}", json.dumps(data), ex=int(ttl_sec))
            except Exception:
                pass

    def get_corpus(self, project_id: str) -> list[dict] | None:
        return self.corpus_cache.get(f"corpus:{project_id}")

    def set_corpus(self, project_id: str, chunks: list[dict], ttl_sec: float = 60.0) -> None:
        self.corpus_cache.set(f"corpus:{project_id}", chunks, ttl_sec=ttl_sec)

    def invalidate_project(self, project_id: str) -> None:
        self.corpus_cache.delete(f"corpus:{project_id}")
        log.info("Invalidated corpus cache for project %s", project_id)


cache_service = TieredCacheService()
