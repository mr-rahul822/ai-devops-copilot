from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    port: int = 8001
    database_url: str
    auth_service_url: str = "http://auth-service:3001"
    default_user_id: str = "00000000-0000-0000-0000-000000000001"
    collection_interval_seconds: int = 60
    environment: str = "development"
    kafka_broker: str = "kafka:9092"  # Phase 3: Kafka producer

    # AWS ARN-based authentication (STS AssumeRole)
    aws_role_arn: str = ""                # Currently assumed role ARN (runtime)
    aws_default_region: str = "us-east-1"
    platform_account_id: str = "482624378370"  # Platform's own AWS account ID

    # Ephemeral STS credentials (in-memory only, refreshed every 55 min)
    aws_access_key_id: str = ""       # Temp credential from AssumeRole
    aws_secret_access_key: str = ""   # Temp credential from AssumeRole
    aws_session_token: str = ""       # Temp session token from AssumeRole

    encryption_key: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


settings = Settings()
