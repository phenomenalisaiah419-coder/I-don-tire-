import os
import secrets
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = "sqlite:///./phenova.db"
    jwt_secret: str = ""
    media_root: str = "./media"
    ffmpeg_bin: str = "ffmpeg"
    ffprobe_bin: str = "ffprobe"
    ifec_base_url: str | None = None
    ifec_enabled: bool = False
    ai_provider_url: str | None = None
    ai_provider_api_key: str | None = None
    ai_model: str | None = None
    ai_timeout_seconds: int = 60
    transcription_model: str | None = None
    transcription_timeout_seconds: int = 300

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
if not settings.jwt_secret:
    if os.getenv("PHENOVA_ENV", "development").lower() in {"production", "prod"}:
        raise RuntimeError("JWT_SECRET must be configured with at least 32 characters")
    settings.jwt_secret = secrets.token_urlsafe(48)
elif len(settings.jwt_secret) < 32 and os.getenv("PHENOVA_ENV", "development").lower() in {"production", "prod"}:
    raise RuntimeError("JWT_SECRET must be at least 32 characters in production")

