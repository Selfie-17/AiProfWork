import time
import pytest
from app.services.provider_manager import (
    CircuitBreaker,
    CircuitState,
    TASK_ROUTING,
    normalize_task,
    RuntimeProviderManager,
)
from app.services.llm_client import TransientProviderError, ClientProviderError


def test_circuit_breaker_transitions():
    cb = CircuitBreaker("TEST_PROVIDER", failure_threshold=3, failure_window=10.0, recovery_timeout=0.1)
    assert cb.state == CircuitState.CLOSED
    assert cb.can_attempt() is True

    # 1st and 2nd failure - remains CLOSED
    cb.record_failure()
    assert cb.state == CircuitState.CLOSED
    cb.record_failure()
    assert cb.state == CircuitState.CLOSED

    # 3rd failure within window - trips to OPEN
    cb.record_failure()
    assert cb.state == CircuitState.OPEN
    assert cb.can_attempt() is False

    # Wait for recovery timeout (0.1s)
    time.sleep(0.12)
    # Probing should transition to HALF_OPEN
    assert cb.can_attempt() is True
    assert cb.state == CircuitState.HALF_OPEN

    # Failure during HALF_OPEN should immediately reopen
    cb.record_failure()
    assert cb.state == CircuitState.OPEN
    assert cb.can_attempt() is False

    # Wait for recovery timeout again
    time.sleep(0.12)
    assert cb.can_attempt() is True
    assert cb.state == CircuitState.HALF_OPEN

    # Success during HALF_OPEN should close breaker
    cb.record_success()
    assert cb.state == CircuitState.CLOSED
    assert cb.can_attempt() is True


def test_task_normalization():
    assert normalize_task("tutor_chat") == "tutor"
    assert normalize_task("quiz_generate") == "quiz"
    assert normalize_task("quiz_eval") == "quiz"
    assert normalize_task("flashcard_generation") == "flashcards"
    assert normalize_task("study_plan") == "study_plan"
    assert normalize_task("mistake_analysis") == "misconception"
    assert normalize_task("eval") == "eval"


def test_task_routing_defaults():
    assert TASK_ROUTING["tutor"] == "groq"
    assert TASK_ROUTING["quiz"] == "groq"
    assert TASK_ROUTING["flashcards"] == "groq"
    assert TASK_ROUTING["study_plan"] == "groq"
    assert TASK_ROUTING["misconception"] == "groq"
    assert TASK_ROUTING["eval"] == "gemini"


def test_provider_chain_circuit_fallback():
    mgr = RuntimeProviderManager()
    # Mock active credentials
    mgr._cache = {
        "GROQ": {"apiKey": "dummy-groq", "active": True, "selectedModel": "llama-3.3-70b-versatile"},
        "GEMINI": {"apiKey": "dummy-gemini", "active": True, "selectedModel": "gemini-2.0-flash"},
    }
    mgr._last_loaded_at = time.time()

    # Normal state for tutor -> Groq first
    chain_tutor = mgr.get_provider_chain_for_task("tutor")
    assert chain_tutor[0] == "groq"
    assert chain_tutor[1] == "gemini"

    # Normal state for eval -> Gemini first
    chain_eval = mgr.get_provider_chain_for_task("eval")
    assert chain_eval[0] == "gemini"
    assert chain_eval[1] == "groq"

    # Trip Groq breaker
    groq_cb = mgr.get_circuit_breaker("GROQ")
    for _ in range(5):
        groq_cb.record_failure()
    assert groq_cb.state == CircuitState.OPEN

    # Now tutor request should bypass Groq and route Gemini first!
    fallback_chain = mgr.get_provider_chain_for_task("tutor")
    assert fallback_chain[0] == "gemini"
