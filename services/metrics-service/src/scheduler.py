import logging
import uuid
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from src.collectors import aws_collector
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
        raw_list = aws_collector.collect()
        
        async with AsyncSessionLocal() as session:
            for raw in raw_list:
                metric = normalize(raw)
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
                
                logger.info(
                    "Collected [%s]: cpu=%.1f%% ram=%s",
                    metric.service_name,
                    metric.cpu_percent,
                    f"{metric.ram_percent:.1f}%" if metric.ram_percent is not None else "N/A",
                )

                # Publish to Kafka
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

            await session.commit()

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
        misfire_grace_time=10,
    )
    scheduler.start()
    logger.info("Scheduler started — collecting every %d seconds.", interval_seconds)


def stop_scheduler():
    """Gracefully shuts down the scheduler on app exit."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped.")


async def run_once() -> list[dict]:
    """
    Manually triggers a single collection cycle (used by POST /metrics/collect).
    Returns the NormalizedMetrics dicts that were saved.
    """
    raw_list = aws_collector.collect()
    saved = []

    async with AsyncSessionLocal() as session:
        for raw in raw_list:
            metric = normalize(raw)
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
            saved.append(row)

        await session.commit()
        for r in saved:
            await session.refresh(r)

    return saved
