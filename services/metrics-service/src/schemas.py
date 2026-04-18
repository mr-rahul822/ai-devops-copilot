import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class NormalizedMetric(BaseModel):
    """Canonical metric format — every collector must produce this."""

    user_id: str
    service_name: str
    cpu_percent: float
    ram_percent: float
    disk_percent: float
    source: str = "local"
    region: str = "local"
    timestamp: datetime


class MetricResponse(BaseModel):
    """API response shape for a single metric reading."""

    id: uuid.UUID
    user_id: uuid.UUID
    service_name: str
    cpu_percent: float
    ram_percent: float
    disk_percent: float
    source: str
    region: str
    timestamp: datetime

    model_config = {"from_attributes": True}


class HealthResponse(BaseModel):
    status: str
    scheduler: str


class ServicesResponse(BaseModel):
    services: list[str]


class ErrorResponse(BaseModel):
    error: str
    detail: str = ""
