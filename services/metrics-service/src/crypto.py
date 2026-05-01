"""
src/crypto.py — AES-256 symmetric encryption for cloud credentials.

Uses Fernet (AES-128-CBC under the hood with HMAC-SHA256 for integrity).
The encryption key is read from the ENCRYPTION_KEY environment variable.
"""

import os
import logging
from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)

_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    """Lazily initialise and cache the Fernet cipher."""
    global _fernet
    if _fernet is not None:
        return _fernet

    key = os.getenv("ENCRYPTION_KEY", "")
    if not key:
        raise RuntimeError(
            "ENCRYPTION_KEY environment variable is not set. "
            "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )

    try:
        _fernet = Fernet(key.encode() if isinstance(key, str) else key)
    except Exception as exc:
        raise RuntimeError(f"Invalid ENCRYPTION_KEY: {exc}")

    return _fernet


def encrypt(plaintext: str) -> str:
    """Encrypt a plain-text string and return a URL-safe base64 token."""
    if not plaintext:
        return ""
    return _get_fernet().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt(ciphertext: str) -> str:
    """Decrypt a Fernet token back to the original string."""
    if not ciphertext:
        return ""
    try:
        return _get_fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        logger.error("Failed to decrypt — token is invalid or ENCRYPTION_KEY changed.")
        raise ValueError("Could not decrypt credential. The encryption key may have changed.")
