import logging
import uuid
from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from src.collectors import aws_collector
from src.normalizer import normalize
from src.database import AsyncSessionLocal
from src.models import Metric
from src.kafka.producer import publish_metric
from src.config import settings

logger = logging.getLogger(__name__)

# Module-level scheduler instance (started/stopped via FastAPI lifespan)
scheduler = AsyncIOScheduler()


async def _get_connected_credentials():
    """
    Fetches all connected CloudCredential rows from the database.
    Each row represents a user's connected AWS account.
    Returns a list of dicts with user_id, role_arn, external_id, region.
    """
    async with AsyncSessionLocal() as session:
        from src.routes.onboarding import CloudCredential
        from sqlalchemy import select

        result = await session.execute(
            select(CloudCredential).where(
                CloudCredential.provider == "aws",
                CloudCredential.status == "connected",
            )
        )
        creds = result.scalars().all()

        # Detach from session by copying to dicts
        return [
            {
                "user_id": str(cred.user_id),
                "role_arn": cred.role_arn,
                "external_id": cred.external_id,
                "region": cred.region,
            }
            for cred in creds
        ]


async def _assume_role_for_cred(cred: dict):
    """
    Assumes the IAM role for a given credential dict and returns a boto3 Session.
    Returns None on failure (logged, never raises).
    """
    from src.routes.onboarding import _assume_role

    try:
        assumed_session = _assume_role(cred["role_arn"], cred["external_id"], cred["region"])
        return assumed_session
    except Exception as exc:
        logger.error(
            "Failed to assume role for user %s (arn=%s): %s",
            cred["user_id"], cred["role_arn"], exc,
        )
        return None


async def _collect_and_save():
    """
    Core job: for EACH connected cloud account, assumes role, collects metrics,
    normalises them, persists to PostgreSQL, then publishes to Kafka.

    Multi-tenant: iterates over all connected CloudCredentials so every user's
    infrastructure is collected with the correct user_id.
    All exceptions are caught so a single failure never kills the scheduler.
    """
    try:
        credentials = await _get_connected_credentials()

        if not credentials:
            logger.info("No connected cloud accounts — skipping collection.")
            return

        logger.info("Collecting metrics for %d connected account(s).", len(credentials))

        for cred in credentials:
            try:
                assumed_session = await _assume_role_for_cred(cred)
                if not assumed_session:
                    continue

                raw_list = aws_collector.collect(
                    boto3_session=assumed_session,
                    region=cred["region"],
                    user_id=cred["user_id"],
                )

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
                            "Collected [%s] (user=%s): cpu=%.1f%% ram=%s",
                            metric.service_name,
                            cred["user_id"],
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
                logger.error(
                    "Metric collection failed for user %s: %s",
                    cred["user_id"], exc, exc_info=True,
                )

    except Exception as exc:
        logger.error("Metric collection failed: %s", exc, exc_info=True)


async def _refresh_credentials():
    """
    Re-assumes the IAM Role for ALL connected accounts to get fresh temporary
    credentials before they expire.
    STS credentials last 1 hour — refresh at 55 min to avoid expiry mid-collection.
    """
    try:
        async with AsyncSessionLocal() as session:
            from src.routes.onboarding import CloudCredential, _assume_role
            from sqlalchemy import select

            result = await session.execute(
                select(CloudCredential).where(
                    CloudCredential.provider == "aws",
                    CloudCredential.status == "connected",
                )
            )
            creds = result.scalars().all()

            if not creds:
                return

            for cred in creds:
                try:
                    # Re-assume role
                    new_session = _assume_role(cred.role_arn, cred.external_id, cred.region)

                    # Update DB expiry
                    cred.temp_credentials_expire_at = datetime.utcnow() + timedelta(hours=1)
                    cred.last_sync_at = datetime.utcnow()

                    logger.info(
                        "AWS credentials refreshed for user %s (expires in 1 hour).",
                        cred.user_id,
                    )
                except Exception as exc:
                    logger.error(
                        "Credential refresh failed for user %s: %s",
                        cred.user_id, exc, exc_info=True,
                    )

            await session.commit()

    except Exception as exc:
        logger.error("Credential refresh failed: %s", exc, exc_info=True)


def start_scheduler(interval_seconds: int = 60):
    """Registers the collection job and credential refresh, then starts the scheduler."""
    scheduler.add_job(
        _collect_and_save,
        trigger="interval",
        seconds=interval_seconds,
        id="collect_metrics",
        replace_existing=True,
        misfire_grace_time=10,
    )

    # Refresh STS credentials every 55 minutes (before 1-hour expiry)
    scheduler.add_job(
        _refresh_credentials,
        trigger="interval",
        minutes=55,
        id="refresh_credentials",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Scheduler started — collecting every %d seconds, credentials refresh every 55 min.", interval_seconds)


def stop_scheduler():
    """Gracefully shuts down the scheduler on app exit."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped.")


async def run_once() -> list[dict]:
    """
    Manually triggers a single collection cycle (used by POST /metrics/collect).
    Returns the Metric rows that were saved across ALL connected accounts.
    """
    credentials = await _get_connected_credentials()

    if not credentials:
        logger.warning("No connected cloud accounts — nothing to collect.")
        return []

    all_saved = []

    for cred in credentials:
        try:
            assumed_session = await _assume_role_for_cred(cred)
            if not assumed_session:
                continue

            raw_list = aws_collector.collect(
                boto3_session=assumed_session,
                region=cred["region"],
                user_id=cred["user_id"],
            )

            async with AsyncSessionLocal() as session:
                saved = []
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
                all_saved.extend(saved)

        except Exception as exc:
            logger.error(
                "Manual collection failed for user %s: %s",
                cred["user_id"], exc, exc_info=True,
            )

    return all_saved
