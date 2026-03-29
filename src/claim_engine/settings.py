from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=ENV_PATH)


class Settings(BaseSettings):
    openai_api_key: str = Field(default="")
    openai_model: str = Field(default="gpt-5-mini")
    serpapi_api_key: str = Field(default="")
    serpapi_google_domain: str = Field(default="google.com")
    serpapi_gl: str = Field(default="us")
    serpapi_hl: str = Field(default="en")
    retrieval_provider: str = Field(default="duckduckgo")

    model_config = SettingsConfigDict(env_prefix="", extra="ignore")


settings = Settings()
