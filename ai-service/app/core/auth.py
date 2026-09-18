from fastapi import Header, HTTPException
from app.core.config import settings


async def require_internal(x_internal_secret: str | None = Header(default=None)):
    if x_internal_secret != settings.internal_service_secret:
        raise HTTPException(status_code=401, detail="Invalid internal secret")
