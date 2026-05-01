"""
src/main.py — FastAPI application entry point for the Action Service.

The Action Service executes AI-recommended infrastructure fixes:
  - Docker container operations (restart, stop, logs, stats)
  - AWS operations (rollback, scale, status) — DRY_RUN by default
  - Full approval workflow with 30-minute expiry
  - Immutable audit trail for every action
"""

import logging
import platform
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from src.database import init_db
from src.routes.actions import router as actions_router

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
    logger.info("Starting Action Service…")

    # 1. Create DB tables
    await init_db()
    logger.info("Database tables initialised.")

    # 2. Log Docker connectivity
    try:
        from src.executors.docker_executor import DockerExecutor
        docker_exec = DockerExecutor()
        if docker_exec.is_connected:
            logger.info("Docker daemon: CONNECTED ✓")
        else:
            logger.warning("Docker daemon: NOT CONNECTED ✗")
    except Exception as e:
        logger.warning("Docker daemon: NOT AVAILABLE — %s", e)

    yield  # app is live and serving requests here

    # ── SHUTDOWN ─────────────────────────────────────────────────────────
    logger.info("Action Service shut down cleanly.")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="AI DevOps Copilot — Action Service",
    description=(
        "Executes AI-recommended infrastructure fixes with approval workflow, "
        "Docker/AWS executors, and immutable audit trail."
    ),
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
app.include_router(actions_router)


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
        "service": "action-service",
        "version": "1.0.0",
        "docs": "/docs",
    }


# ---------------------------------------------------------------------------
# Health endpoint — reports Docker client connectivity
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    docker_status = "unknown"
    docker_error = None

    try:
        from src.executors.docker_executor import DockerExecutor
        executor = DockerExecutor()
        if executor.is_connected:
            docker_status = "connected"
        else:
            docker_status = "unavailable"
            docker_error = "Docker client not connected — check socket mount"
    except Exception as e:
        docker_status = "error"
        docker_error = str(e)

    return {
        "status": "ok",
        "docker_client": docker_status,
        "docker_error": docker_error,
        "platform": platform.system(),
    }
