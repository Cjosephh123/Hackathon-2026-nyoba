import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_anon_key: str
    ai_api_key: str
    ai_base_url: str
    frontend_origins: tuple[str, ...]
    upload_max_bytes: int = 10 * 1024 * 1024
    supabase_service_role_key: str = ""
    gmail_smtp_host: str = "smtp.gmail.com"
    gmail_smtp_port: int = 465
    gmail_smtp_username: str = ""
    gmail_smtp_app_password: str = ""


def get_settings() -> Settings:
    default_origins = "http://localhost:5173,http://127.0.0.1:5173"
    origins = tuple(
        origin.strip().rstrip("/")
        for origin in os.getenv("FRONTEND_ORIGINS", default_origins).split(",")
        if origin.strip()
    )

    return Settings(
        supabase_url=os.getenv("SUPABASE_URL", "").rstrip("/"),
        supabase_anon_key=os.getenv("SUPABASE_ANON_KEY", ""),
        ai_api_key=os.getenv("CBN_HACKATHON_API_KEY", ""),
        ai_base_url=os.getenv(
            "CBN_HACKATHON_BASE_URL",
            "https://litellm-hackathon.digdaya.ai/v1",
        ).rstrip("/"),
        frontend_origins=origins,
        supabase_service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
        gmail_smtp_host=os.getenv("GMAIL_SMTP_HOST", "smtp.gmail.com"),
        gmail_smtp_port=int(os.getenv("GMAIL_SMTP_PORT", "465")),
        gmail_smtp_username=os.getenv("GMAIL_SMTP_USERNAME", ""),
        gmail_smtp_app_password=os.getenv("GMAIL_SMTP_APP_PASSWORD", ""),
    )