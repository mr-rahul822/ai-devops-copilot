# ═══════════════════════════════════════════════════════════════════════
# Structured JSON Logger — Python Services
# ═══════════════════════════════════════════════════════════════════════
# Outputs structured JSON logs compatible with Loki/Promtail parsing.
# Each log line contains: timestamp, service, level, message,
# and optional trace_id/user_id for correlation.
# ═══════════════════════════════════════════════════════════════════════

import logging
import os
from datetime import datetime, timezone

from pythonjsonlogger import jsonlogger

SERVICE_NAME = os.getenv("SERVICE_NAME", "unknown")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")


class SentinelJSONFormatter(jsonlogger.JsonFormatter):
    """Custom JSON formatter that injects platform-standard fields."""

    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)
        log_record["timestamp"] = datetime.now(timezone.utc).isoformat()
        log_record["service"] = SERVICE_NAME
        log_record["level"] = record.levelname
        log_record["logger"] = record.name

        # Include trace_id if set in context (via extra={} or LoggerAdapter)
        trace_id = getattr(record, "trace_id", None)
        if trace_id:
            log_record["trace_id"] = trace_id

        user_id = getattr(record, "user_id", None)
        if user_id:
            log_record["user_id"] = user_id


def get_logger(name: str) -> logging.Logger:
    """
    Creates a logger with structured JSON output.
    Call once per module: logger = get_logger(__name__)
    """
    logger = logging.getLogger(name)

    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = SentinelJSONFormatter(
            "%(timestamp)s %(service)s %(level)s %(message)s"
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))

    return logger


def setup_structured_logging():
    """
    Reconfigure the root logger for structured JSON output.
    Call once at application startup to convert all loggers.
    """
    root = logging.getLogger()
    root.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))

    # Remove existing handlers
    for handler in root.handlers[:]:
        root.removeHandler(handler)

    # Add JSON handler
    handler = logging.StreamHandler()
    formatter = SentinelJSONFormatter(
        "%(timestamp)s %(service)s %(level)s %(message)s"
    )
    handler.setFormatter(formatter)
    root.addHandler(handler)

    # Quiet down noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
