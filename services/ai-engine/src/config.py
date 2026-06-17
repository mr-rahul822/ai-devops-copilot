"""
src/config.py — Centralised settings loaded from environment / .env file.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    port: int = 8002
    database_url: str
    anthropic_api_key: str = ""
    pinecone_api_key: str = ""
    pinecone_index_name: str = "devops-incidents"
    metrics_service_url: str = "http://metrics-service:8001"
    alert_service_url: str = "http://alert-service:3003"
    auth_service_url: str = "http://auth-service:3001"
    jwt_secret: str = ""
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    internal_secret: str = "devops-copilot-internal-2026"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


settings = Settings()
