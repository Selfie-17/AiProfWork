from __future__ import annotations

import base64
import hashlib
import os
import logging
from app.core.config import settings

log = logging.getLogger("ai.crypto")


def _get_master_key() -> bytes:
    """Derive or parse a 32-byte (256-bit) encryption key."""
    configured_key = getattr(settings, "ai_encryption_key", "") or ""
    if configured_key and len(configured_key.strip()) >= 16:
        # If given as hex or raw string, hash with sha256 to ensure exact 32 bytes
        return hashlib.sha256(configured_key.strip().encode("utf-8")).digest()

    # Fallback to deterministic derivation from internal service secret
    secret = settings.internal_service_secret or "default-study-companion-secret"
    derived = hashlib.sha256((secret + ":ai-key-encryption-salt-v1").encode("utf-8")).digest()
    return derived


def encrypt_api_key(plaintext: str) -> str:
    """Encrypt a plaintext API key using AES-256-GCM.
    
    Returns base64-encoded string containing nonce (12 bytes) + ciphertext + tag.
    """
    if not plaintext or not plaintext.strip():
        return ""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    key = _get_master_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    clean_bytes = plaintext.strip().encode("utf-8")
    encrypted = aesgcm.encrypt(nonce, clean_bytes, None)
    return base64.urlsafe_b64encode(nonce + encrypted).decode("ascii")


def decrypt_api_key(encrypted_b64: str) -> str:
    """Decrypt a base64-encoded AES-256-GCM encrypted API key."""
    if not encrypted_b64 or not encrypted_b64.strip():
        return ""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    try:
        raw = base64.urlsafe_b64decode(encrypted_b64.strip().encode("ascii"))
        if len(raw) < 28:  # 12 nonce + 16 tag minimum
            log.warning("encrypted payload too short")
            return ""
        nonce = raw[:12]
        ciphertext = raw[12:]
        key = _get_master_key()
        aesgcm = AESGCM(key)
        decrypted = aesgcm.decrypt(nonce, ciphertext, None)
        return decrypted.decode("utf-8")
    except Exception as ex:
        log.error("Failed to decrypt API key: %s", ex)
        return ""


def mask_key(key: str | None) -> str | None:
    """Mask an API key for safe UI and API responses (e.g. ••••••••••••xYz9).
    
    Plaintext is NEVER returned.
    """
    if not key or not key.strip():
        return None
    k = key.strip()
    if len(k) <= 6:
        return "••••••••"
    return "••••••••••••" + k[-4:]
