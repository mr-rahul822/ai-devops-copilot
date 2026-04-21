import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Float, Index
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from src.database import Base


class Metric(Base):
    """SQLAlchemy ORM model for the metrics table."""

    __tablename__ = "metrics"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    service_name: Mapped[str] = mapped_column(String(100), nullable=False)
    cpu_percent: Mapped[float] = mapped_column(Float, nullable=False)
    ram_percent: Mapped[float] = mapped_column(Float, nullable=False)
    disk_percent: Mapped[float] = mapped_column(Float, nullable=False)
    source: Mapped[str] = mapped_column(String(50), default="local")
    region: Mapped[str] = mapped_column(String(50), default="local")
    timestamp: Mapped[datetime] = mapped_column(
        default=datetime.utcnow
    )

    __table_args__ = (
        Index("idx_metrics_user_service", "user_id", "service_name"),
        Index("idx_metrics_timestamp", "timestamp"),
    )

    def __repr__(self) -> str:
        return (
            f"<Metric service={self.service_name} "
            f"cpu={self.cpu_percent} ram={self.ram_percent}>"
        )
