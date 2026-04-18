import logging
import uuid
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from src.collectors import local_collector
from src.normalizer import normalize
from src.database import AsyncSessionLocal
from src.models import Metric
from src.kafka.producer import publish_metric

logger = logging.getLogger(__name__)

# Module-level scheduler instance (started/stopped via FastAPI lifespan)
scheduler = AsyncIOScheduler()


async def _collect_and_save():
    """
    Core job: collects metrics, normalises them, persists to PostgreSQL,
    then publishes the same reading to the Kafka metrics-stream topic.
    All exceptions are caught so a single failure never kills the scheduler.
    """
    try:
        raw = local_collector.collect()
        metric = normalize(raw)

        async with AsyncSessionLocal() as session:
            row = Metric(
                user_id=uuid.UUID(metric.user_id),
                service_name=metric.service_name,
                cpu_percent=metric.cpu_percent,
                ram_percent=metric.ram_percent,
                disk_percent=metric.disk_percent,
                source=metric.source,
                region=metric.region,
                timestamp=metric.timestamp,
            )
            session.add(row)
            await session.commit()

        logger.info(
            "Collected metrics: cpu=%.1f%% ram=%.1f%% disk=%.1f%%",
            metric.cpu_percent,
            metric.ram_percent,
            metric.disk_percent,
        )

        # Publish to Kafka (non-fatal — DB write already succeeded)
        await publish_metric({
            "user_id": metric.user_id,
            "service_name": metric.service_name,
            "cpu_percent": metric.cpu_percent,
            "ram_percent": metric.ram_percent,
            "disk_percent": metric.disk_percent,
            "source": metric.source,
            "region": metric.region,
            "timestamp": metric.timestamp,
        })

    except Exception as exc:
        logger.error("Metric collection failed: %s", exc, exc_info=True)


def start_scheduler(interval_seconds: int = 60):
    """Registers the collection job and starts the APScheduler event loop."""
    scheduler.add_job(
        _collect_and_save,
        trigger="interval",
        seconds=interval_seconds,
        id="collect_metrics",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started — collecting every %d seconds.", interval_seconds)


def stop_scheduler():
    """Gracefully shuts down the scheduler on app exit."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped.")


async def run_once() -> dict:
    """
    Manually triggers a single collection cycle (used by POST /metrics/collect).
    Returns the NormalizedMetric dict that was saved.
    """
    raw = local_collector.collect()
    metric = normalize(raw)

    async with AsyncSessionLocal() as session:
        row = Metric(
            user_id=uuid.UUID(metric.user_id),
            service_name=metric.service_name,
            cpu_percent=metric.cpu_percent,
            ram_percent=metric.ram_percent,
            disk_percent=metric.disk_percent,
            source=metric.source,
            region=metric.region,
            timestamp=metric.timestamp,
        )
        session.add(row)
        await session.commit()
        await session.refresh(row)

    # Publish to Kafka after manual trigger too
    await publish_metric({
        "user_id": metric.user_id,
        "service_name": metric.service_name,
        "cpu_percent": metric.cpu_percent,
        "ram_percent": metric.ram_percent,
        "disk_percent": metric.disk_percent,
        "source": metric.source,
        "region": metric.region,
        "timestamp": metric.timestamp,
    })

    return row
