from pathlib import Path
from pydantic_settings import BaseSettings

_CURRENT_DIR = Path(__file__).resolve().parent
_ROOT_DIR = _CURRENT_DIR.parent.parent.parent


class Settings(BaseSettings):
    mongo_uri: str = "mongodb://localhost:27017/studycompanion"
    redis_url: str = "redis://localhost:6381"
    internal_service_secret: str = "change-me-internal-secret"
    primary_provider: str = "groq"
    fallback_provider: str = "gemini"
    gemini_api_key: str = ""
    groq_api_key: str = ""
    ai_encryption_key: str = ""
    embedding_dim: int = 384
    retrieval_threshold: float = 0.18
    spring_internal_url: str = "http://localhost:8080"

    class Config:
        env_file = [
            str(_ROOT_DIR / ".env"),
            str(_CURRENT_DIR.parent.parent / ".env"),
            ".env",
            "../.env",
        ]
        extra = "ignore"


settings = Settings()

