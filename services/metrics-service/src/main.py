import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from src.config import settings
from src.database import init_db
from src.routes.metrics import router as metrics_router
from src.routes.onboarding import router as onboarding_router
from src.scheduler import start_scheduler, stop_scheduler
from src.kafka.producer import start_producer, stop_producer

# ---------------------------------------------------------------------------
# Logging configuration
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)



# ---------------------------------------------------------------------------
# Restore AWS session on startup
# ---------------------------------------------------------------------------

async def _restore_cloud_session():
    """
    On startup, check if a cloud connection was previously established
    (saved in cloud_credentials table). If so, re-assume the IAM role to
    get fresh temporary credentials and populate `settings` before the
    scheduler starts.

    This prevents the scheduler from running with stale/empty credentials
    after a container restart — which previously caused
    `UnauthorizedOperation: ec2:DescribeInstances` errors on every tick.

    Safe to call even if no cloud account was ever connected — it's a
    no-op in that case (settings.aws_access_key_id remains whatever the
    base .env credentials are, and the scheduler's existing check for
    "no running instances" / empty credentials handles that gracefully).
    """
    from sqlalchemy import select
    from src.database import AsyncSessionLocal
    from src.routes.onboarding import CloudCredential, _assume_role

    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(CloudCredential).where(
                    CloudCredential.provider == "aws",
                    CloudCredential.status == "connected",
                )
            )
            cred = result.scalars().first()

            if not cred:
                logger.info("No saved cloud connection found — scheduler will start without AWS credentials.")
                return

            logger.info(
                "Found saved AWS connection (role_arn=%s, region=%s) — re-assuming role to restore credentials...",
                cred.role_arn, cred.region,
            )

            assumed_session = _assume_role(cred.role_arn, cred.external_id, cred.region)
            assumed_creds = assumed_session.get_credentials().get_frozen_credentials()

            settings.aws_role_arn = cred.role_arn
            settings.aws_access_key_id = assumed_creds.access_key
            settings.aws_secret_access_key = assumed_creds.secret_key
            settings.aws_session_token = assumed_creds.token
            settings.aws_default_region = cred.region

            # Update last_sync_at and expiry to reflect the fresh credentials
            from datetime import datetime, timedelta
            cred.last_sync_at = datetime.utcnow()
            cred.temp_credentials_expire_at = datetime.utcnow() + timedelta(hours=1)
            await session.commit()

            logger.info("AWS session restored successfully on startup — scheduler will use temporary role credentials.")

    except Exception as exc:
        # Never let a credential-restore failure block the whole service from starting.
        # Log it clearly so it's visible in `docker logs`, but continue startup —
        # the scheduler will simply log its own "no running instances" / auth errors
        # if credentials truly aren't usable, same as before this fix.
        logger.error(
            "Failed to restore AWS session on startup: %s. "
            "Scheduler will start without valid AWS credentials — "
            "reconnect via Cloud Configuration if metrics don't appear.",
            exc,
        )


# ---------------------------------------------------------------------------
# FastAPI lifespan — startup + shutdown
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── STARTUP ──────────────────────────────────────────────────────────
    logger.info("Starting Metrics Collector Service…")

    # 1. Create DB tables
    await init_db()
    logger.info("Database tables initialised.")

    # 1b. Migrate cloud_credentials table (ARN migration)
    try:
        from src.database import engine
        from sqlalchemy import text as sa_text
        async with engine.begin() as conn:
            migrations = [
                "ALTER TABLE cloud_credentials ADD COLUMN IF NOT EXISTS role_arn TEXT",
                "ALTER TABLE cloud_credentials ADD COLUMN IF NOT EXISTS external_id VARCHAR(100)",
                "ALTER TABLE cloud_credentials ADD COLUMN IF NOT EXISTS temp_credentials_expire_at TIMESTAMP",
                "ALTER TABLE cloud_credentials DROP COLUMN IF EXISTS access_key_encrypted",
                "ALTER TABLE cloud_credentials DROP COLUMN IF EXISTS secret_key_encrypted",
            ]
            for stmt in migrations:
                try:
                    await conn.execute(sa_text(stmt))
                except Exception:
                    pass  # Column may already exist/not exist
        logger.info("cloud_credentials table migration complete.")
    except Exception as exc:
        logger.warning("cloud_credentials migration skipped: %s", exc)

    # 2. Restore AWS session from saved cloud_credentials (if any) —
    #    must happen BEFORE the scheduler starts so the first tick has
    #    valid (re-assumed) temporary credentials instead of stale/empty ones.
    await _restore_cloud_session()

    # 3. Start Kafka Producer
    await start_producer()

    # 4. Start background scheduler
    start_scheduler(interval_seconds=settings.collection_interval_seconds)

    yield  # app is live and serving requests here

    # ── SHUTDOWN ─────────────────────────────────────────────────────────
    stop_scheduler()
    await stop_producer()
    logger.info("Metrics Collector Service shut down cleanly.")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="AI DevOps Copilot — Metrics Collector",
    description="Collects CPU/RAM/disk metrics on a schedule and exposes them via REST.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routes
app.include_router(metrics_router)
app.include_router(onboarding_router)


# ---------------------------------------------------------------------------
# Global exception handler
# ---------------------------------------------------------------------------

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc)},
    )


# ---------------------------------------------------------------------------
# Root endpoint
# ---------------------------------------------------------------------------

@app.get("/")
async def root():
    return {
        "service": "metrics-collector",
        "version": "1.0.0",
        "docs": "/docs",
    }
