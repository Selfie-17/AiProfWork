from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, HTTPException
import httpx
from app.core.auth import require_internal
from app.models.provider_config import (
    ProviderConfigIn,
    ProviderConfigOut,
    ProviderTestIn,
    ProviderTestOut,
)
from app.services.provider_manager import (
    GEMINI_GENERATIVE_MODELS,
    GROQ_GENERATIVE_MODELS,
    provider_manager,
)

log = logging.getLogger("ai.providers_router")
router = APIRouter(tags=["providers"])


@router.get("", response_model=list[ProviderConfigOut])
def list_providers(_=Depends(require_internal)):
    """List current status, active state, selected model, and masked keys for all AI providers."""
    return [
        provider_manager.get_public_config("GEMINI"),
        provider_manager.get_public_config("GROQ"),
    ]


@router.get("/{provider}", response_model=ProviderConfigOut)
def get_provider(provider: str, _=Depends(require_internal)):
    p = provider.upper()
    if p not in ("GEMINI", "GROQ"):
        raise HTTPException(status_code=400, detail=f"Unsupported provider '{provider}'")
    return provider_manager.get_public_config(p)


@router.post("/{provider}", response_model=ProviderConfigOut)
def save_provider(provider: str, req: ProviderConfigIn, _=Depends(require_internal)):
    """Save or update API key, active model, or enabled status for a provider."""
    p = provider.upper()
    if p not in ("GEMINI", "GROQ"):
        raise HTTPException(status_code=400, detail=f"Unsupported provider '{provider}'")

    # If updating an API key, optionally test it first
    if req.apiKey and req.apiKey.strip():
        test_res = provider_manager.test_connection(p, key_override=req.apiKey.strip(), model_override=req.selectedModel)
        if not test_res.success and test_res.statusCode in (401, 403):
            raise HTTPException(status_code=400, detail="API key was rejected by provider.")

    updated = provider_manager.save_provider_config(
        provider=p,
        api_key=req.apiKey,
        selected_model=req.selectedModel,
        active=req.active,
    )
    return updated


@router.post("/{provider}/test", response_model=ProviderTestOut)
def test_provider(provider: str, req: ProviderTestIn | None = None, _=Depends(require_internal)):
    """Test connection with the provider using existing or proposed API key/model."""
    p = provider.upper()
    if p not in ("GEMINI", "GROQ"):
        raise HTTPException(status_code=400, detail=f"Unsupported provider '{provider}'")

    key_override = req.apiKey if req else None
    model_override = req.model if req else None
    return provider_manager.test_connection(p, key_override=key_override, model_override=model_override)


@router.delete("/{provider}")
def delete_provider(provider: str, _=Depends(require_internal)):
    """Deactivate and delete stored configuration for a provider."""
    p = provider.upper()
    if p not in ("GEMINI", "GROQ"):
        raise HTTPException(status_code=400, detail=f"Unsupported provider '{provider}'")
    provider_manager.delete_provider_config(p)
    return {"ok": True, "message": f"{p} configuration removed"}


@router.get("/{provider}/models")
def get_available_models(provider: str, _=Depends(require_internal)):
    """Discover available generative text models from the provider endpoint."""
    p = provider.upper()
    if p == "GEMINI":
        key, _, _ = provider_manager.get_active_credentials("GEMINI")
        if key:
            try:
                url = "https://generativelanguage.googleapis.com/v1beta/models"
                r = httpx.get(url, headers={"x-goog-api-key": key}, timeout=8)
                if r.status_code == 200:
                    data = r.json()
                    models = []
                    for item in data.get("models", []):
                        name = item.get("name", "").replace("models/", "")
                        methods = item.get("supportedGenerationMethods", [])
                        if "generateContent" in methods:
                            # Filter to text generative models, skip embeddings/aqa/whisper/veo
                            if any(name.startswith(prefix) for prefix in ("gemini-", "gemma-")) and "embedding" not in name:
                                models.append(name)
                    if models:
                        return {"provider": p, "models": models}
            except Exception as ex:
                log.debug("Live Gemini model discovery failed: %s", ex)
        return {"provider": p, "models": GEMINI_GENERATIVE_MODELS}

    elif p == "GROQ":
        key, _, _ = provider_manager.get_active_credentials("GROQ")
        if key:
            try:
                url = "https://api.groq.com/openai/v1/models"
                r = httpx.get(url, headers={"Authorization": f"Bearer {key}"}, timeout=8)
                if r.status_code == 200:
                    data = r.json()
                    models = []
                    for item in data.get("data", []):
                        m_id = item.get("id", "")
                        # Filter to general-purpose text LLMs, exclude whisper, guard, vision
                        if any(m_id.startswith(pref) for pref in ("llama-", "mixtral-", "gemma", "deepseek-", "qwen-")) and "guard" not in m_id:
                            models.append(m_id)
                    if models:
                        return {"provider": p, "models": models}
            except Exception as ex:
                log.debug("Live Groq model discovery failed: %s", ex)
        return {"provider": p, "models": GROQ_GENERATIVE_MODELS}

    raise HTTPException(status_code=400, detail=f"Unsupported provider '{provider}'")
