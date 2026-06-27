from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    port: int = 8001
    database_url: str
    auth_service_url: str = "http://auth-service:3001"
    jwt_secret: str = ""
    default_user_id: str = "00000000-0000-0000-0000-000000000001"
    collection_interval_seconds: int = 60
    environment: str = "development"
    kafka_broker: str = "kafka:9092"  # Phase 3: Kafka producer

    aws_role_arn: str = ""
    frontend_url: str = "http://localhost:5173"
    # AWS_DEFAULT_REGION is only the startup default before any cloud account
    # is connected. Once a user connects via /cloud/connect, this value is
    # overwritten at runtime to match the region they specified for their
    # IAM Role (see onboarding.py STEP J and _restore_cloud_session() in main.py).
    # Single source of truth for the startup default is infra/.env.
    aws_default_region: str = "ap-southeast-2"
    platform_account_id: str = "525987623256"  # Platform's own AWS account ID

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
