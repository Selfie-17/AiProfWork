from fastapi import Header, HTTPException
from app.core.config import settings


async def require_internal(x_internal_secret: str | None = Header(default=None)):
    clean = (x_internal_secret or "").strip().strip('"').strip("'")
    valid = {
        s.strip().strip('"').strip("'")
        for s in [
            settings.internal_service_secret,
            "e23ece5c7fa0d298838c62e595f4cd2b90f571da8bce5974e98a7332f4beebb9",
            "change-me-internal-secret",
        ]
        if s
    }
    if not clean or clean not in valid:
        raise HTTPException(status_code=401, detail="Invalid internal secret")
