from __future__ import annotations

from typing import Any
from pydantic import BaseModel


class ProviderConfigIn(BaseModel):
    apiKey: str | None = None
    selectedModel: str | None = None
    active: bool | None = None


class ProviderConfigOut(BaseModel):
    provider: str
    configured: bool
    active: bool
    selectedModel: str
    maskedKey: str | None = None
    status: str = "UNCONFIGURED"
    lastTestedAt: str | None = None
    lastError: str | None = None
    availableModels: list[str] = []


class ProviderTestIn(BaseModel):
    apiKey: str | None = None
    model: str | None = None


class ProviderTestOut(BaseModel):
    provider: str
    model: str
    success: bool
    latencyMs: int = 0
    message: str
    statusCode: int = 200
