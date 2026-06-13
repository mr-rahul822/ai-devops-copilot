# ═══════════════════════════════════════════════════════════════════════
# OpenTelemetry Distributed Tracing — Python Services
# ═══════════════════════════════════════════════════════════════════════
# Initializes tracing with OTLP export to the OTEL Collector.
# Auto-instruments FastAPI, SQLAlchemy, and httpx.
# Call setup_tracing() once at application startup.
# ═══════════════════════════════════════════════════════════════════════

import os
import logging

logger = logging.getLogger(__name__)

SERVICE_NAME = os.getenv("SERVICE_NAME", "unknown")
OTEL_ENDPOINT = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel-collector:4317")
TRACING_ENABLED = os.getenv("TRACING_ENABLED", "true").lower() == "true"


def setup_tracing(app=None, engine=None):
    """
    Initialize OpenTelemetry tracing for a FastAPI service.
    Call this ONCE at application startup.

    Args:
        app: FastAPI application instance (for auto-instrumentation)
        engine: SQLAlchemy engine instance (for DB tracing)

    Returns:
        tracer: OpenTelemetry tracer for manual spans, or None if disabled
    """
    if not TRACING_ENABLED:
        logger.info("Tracing disabled via TRACING_ENABLED=false")
        return None

    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.resources import Resource, SERVICE_NAME as RESOURCE_SERVICE_NAME

        resource = Resource.create({
            RESOURCE_SERVICE_NAME: SERVICE_NAME,
            "service.version": os.getenv("SERVICE_VERSION", "1.0.0"),
            "deployment.environment": os.getenv("ENVIRONMENT", "production"),
            "platform": "sentinel-ai",
        })

        provider = TracerProvider(resource=resource)

        otlp_exporter = OTLPSpanExporter(
            endpoint=OTEL_ENDPOINT,
            insecure=True,
        )

        provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
        trace.set_tracer_provider(provider)

        # Auto-instrument FastAPI
        if app:
            try:
                from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
                FastAPIInstrumentor.instrument_app(
                    app,
                    excluded_urls="/internal/metrics,/health",
                )
                logger.info("FastAPI auto-instrumentation enabled")
            except ImportError:
                logger.warning("opentelemetry-instrumentation-fastapi not installed")

        # Auto-instrument SQLAlchemy
        if engine:
            try:
                from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
                SQLAlchemyInstrumentor().instrument(
                    engine=engine.sync_engine,
                    enable_commenter=True,
                )
                logger.info("SQLAlchemy auto-instrumentation enabled")
            except (ImportError, AttributeError):
                logger.warning("SQLAlchemy instrumentation skipped")

        # Auto-instrument httpx (for inter-service calls)
        try:
            from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
            HTTPXClientInstrumentor().instrument()
            logger.info("httpx auto-instrumentation enabled")
        except ImportError:
            logger.warning("opentelemetry-instrumentation-httpx not installed")

        logger.info("OpenTelemetry tracing initialized for %s → %s", SERVICE_NAME, OTEL_ENDPOINT)
        return trace.get_tracer(SERVICE_NAME)

    except ImportError as e:
        logger.warning("OpenTelemetry SDK not installed, tracing disabled: %s", e)
        return None
    except Exception as e:
        logger.error("Failed to initialize tracing: %s", e)
        return None
