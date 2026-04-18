"""
metrics-service/src/kafka/producer.py

Async Kafka producer (aiokafka).

Lifecycle:
  - start_producer()  → called once in FastAPI lifespan startup
  - publish_metric()  → called after every DB commit in the scheduler
  - stop_producer()   → called in FastAPI lifespan shutdown

publish_metric() is intentionally non-fatal: if Kafka is down or the
publish fails for any reason, we only log a warning — the metric has
already been saved to PostgreSQL, so no data is lost.
"""

import json
import logging
from datetime import datetime

from aiokafka import AIOKafkaProducer
from aiokafka.errors import KafkaConnectionError

from src.config import settings

logger = logging.getLogger(__name__)

TOPIC = "metrics-stream"

# Module-level singleton — initialized in start_producer()
_producer: AIOKafkaProducer | None = None


def _json_serializer(value: dict) -> bytes:
    """
    JSON-serializes a dict to bytes.
    Handles non-serializable types (datetime, UUID) via str() fallback.
    """
    return json.dumps(value, default=str).encode("utf-8")


async def start_producer() -> None:
    """
    Creates and starts the AIOKafkaProducer.
    Called once during FastAPI lifespan startup.
    """
    global _producer
    try:
        _producer = AIOKafkaProducer(
            bootstrap_servers=settings.kafka_broker,
            value_serializer=_json_serializer,
            # Retry up to 5 times before giving up on a single message
            request_timeout_ms=10_000,
            retry_backoff_ms=500,
        )
        await _producer.start()
        logger.info("Kafka producer started — broker: %s, topic: %s", settings.kafka_broker, TOPIC)
    except KafkaConnectionError as exc:
        logger.warning(
            "Kafka producer could not connect to %s: %s. "
            "Metrics will NOT be published to Kafka, but DB storage continues normally.",
            settings.kafka_broker,
            exc,
        )
        _producer = None


async def publish_metric(metric_dict: dict) -> None:
    """
    Publishes one metric reading to the metrics-stream Kafka topic.

    Args:
        metric_dict: Plain dict matching the NormalizedMetric schema.
                     datetime and UUID values are auto-converted to strings.
    """
    global _producer

    if _producer is None:
        logger.debug("Kafka producer not available — skipping publish.")
        return

    try:
        # Ensure datetime objects are ISO strings before serialising
        payload = {
            **metric_dict,
            "timestamp": (
                metric_dict["timestamp"].isoformat()
                if isinstance(metric_dict.get("timestamp"), datetime)
                else metric_dict.get("timestamp")
            ),
        }
        await _producer.send_and_wait(TOPIC, payload)
        logger.debug("Published metric to %s: service=%s", TOPIC, payload.get("service_name"))
    except Exception as exc:
        # Non-fatal — metric is already in PostgreSQL
        logger.error("Failed to publish metric to Kafka: %s", exc)


async def stop_producer() -> None:
    """
    Gracefully flushes and closes the producer.
    Called during FastAPI lifespan shutdown.
    """
    global _producer
    if _producer is not None:
        try:
            await _producer.stop()
            logger.info("Kafka producer stopped.")
        except Exception as exc:
            logger.error("Error stopping Kafka producer: %s", exc)
        finally:
            _producer = None
