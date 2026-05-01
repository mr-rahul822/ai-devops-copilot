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
# FastAPI lifespan — startup + shutdown
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── STARTUP ──────────────────────────────────────────────────────────
    logger.info("Starting Metrics Collector Service…")

    # 1. Create DB tables
    await init_db()
    logger.info("Database tables initialised.")

    # 2. Start Kafka Producer
    await start_producer()

    # 3. Start background scheduler
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
