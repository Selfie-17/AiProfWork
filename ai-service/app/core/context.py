from __future__ import annotations

from contextvars import ContextVar

# Thread-safe / async request-scoped correlation ID context
correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default="")


def get_correlation_id() -> str:
    """Retrieve the current request's correlation ID, if set."""
    return correlation_id_var.get()


def set_correlation_id(cid: str) -> None:
    """Explicitly assign a correlation ID to the current context."""
    correlation_id_var.set(cid or "")
