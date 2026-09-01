"""Encryption of user-provided API keys at rest.

Keys are encrypted with Fernet (AES-128-CBC + HMAC) derived from the app
secret. They are decrypted only inside API/worker processes on demand,
never logged, never returned by any API route, never sent to session replay.
"""

import base64

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

_SALT = b"ai-codebase-doctor-fixed-salt"


def _derive_key(secret: str) -> bytes:
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=_SALT, iterations=200_000)
    return base64.urlsafe_b64encode(kdf.derive(secret.encode()))


class KeyVault:
    """Encrypt/decrypt user-supplied provider keys."""

    def __init__(self, secret: str) -> None:
        self._fernet = Fernet(_derive_key(secret))

    def encrypt(self, plaintext: str) -> str:
        return self._fernet.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        try:
            return self._fernet.decrypt(ciphertext.encode()).decode()
        except InvalidToken:
            raise ValueError(
                "Unable to decrypt key material: secret changed or data corrupted"
            ) from None
