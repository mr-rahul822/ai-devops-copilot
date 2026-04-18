from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    port: int = 8001
    database_url: str
    auth_service_url: str = "http://auth-service:3001"
    default_user_id: str = "00000000-0000-0000-0000-000000000001"
    collection_interval_seconds: int = 60
    environment: str = "development"
    kafka_broker: str = "kafka:9092"  # Phase 3: Kafka producer

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


settings = Settings()
