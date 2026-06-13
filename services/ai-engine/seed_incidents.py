"""
seed_incidents.py — Seed the Pinecone RAG index with 50 realistic DevOps incidents.

Run with:
    docker exec ai-devops-copilot-ai-engine-1 python3 seed_incidents.py

This is a one-time setup script. Running it multiple times will create
duplicate-ID upserts (Pinecone upsert is idempotent by ID, so re-running
is safe — it will just overwrite the same 50 vectors).
"""

import asyncio
from datetime import datetime, timedelta
import random

from src.config import settings
from src.rag.vector_store import VectorStore

# Generate resolved_at timestamps spread over the last 90 days
def _ts(days_ago: int) -> str:
    dt = datetime.utcnow() - timedelta(days=days_ago, hours=random.randint(0, 23), minutes=random.randint(0, 59))
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")

DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001"

seed_incidents = [
    # ── HIGH CPU (8 incidents) ────────────────────────────────────────────
    {
        "incident_id": "seed-001",
        "text": "HIGH_CPU alert on api-gateway. CPU spiked to 97% due to a runaway Node.js process leaking memory and triggering aggressive garbage collection. The event loop was blocked for 8+ seconds.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "api-gateway",
            "alert_type": "HIGH_CPU",
            "severity": "CRITICAL",
            "resolution": "Identified the memory leak in the request body parser middleware (unbounded buffer accumulation for multipart uploads). Applied patch to stream large uploads instead of buffering. Restarted service with `docker compose restart api-gateway`.",
            "resolved_at": _ts(3),
        },
    },
    {
        "incident_id": "seed-002",
        "text": "HIGH_CPU alert on worker-service. CPU at 94% caused by an infinite loop in the cron job scheduler. The retry logic for failed jobs had no max-retry limit, causing exponential task spawning.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "worker-service",
            "alert_type": "HIGH_CPU",
            "severity": "HIGH",
            "resolution": "Added max_retries=5 to the job retry configuration in worker/config.py. Killed the stuck cron process with `kill -9 $(pgrep -f 'cron_scheduler')` and restarted the service.",
            "resolved_at": _ts(7),
        },
    },
    {
        "incident_id": "seed-003",
        "text": "HIGH_CPU alert on web-frontend. CPU at 89% during a traffic spike from a viral social media post. Normal traffic is 500 req/s but peaked at 4200 req/s.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "web-frontend",
            "alert_type": "HIGH_CPU",
            "severity": "HIGH",
            "resolution": "Scaled the web-frontend service from 2 to 6 replicas using `docker service scale web-frontend=6`. Added rate limiting at the load balancer (100 req/s per IP). Traffic normalized after 45 minutes.",
            "resolved_at": _ts(12),
        },
    },
    {
        "incident_id": "seed-004",
        "text": "HIGH_CPU alert on reporting-service. CPU at 91% caused by a complex aggregation query running without proper indexing. The query was scanning 12M rows per execution.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "reporting-service",
            "alert_type": "HIGH_CPU",
            "severity": "HIGH",
            "resolution": "Created a composite index on (created_at, status, user_id) in the reports table: `CREATE INDEX idx_reports_composite ON reports(created_at, status, user_id)`. Query time dropped from 45s to 0.3s. CPU returned to 15%.",
            "resolved_at": _ts(15),
        },
    },
    {
        "incident_id": "seed-005",
        "text": "HIGH_CPU on test EC2 instance. CPU at 85% due to CloudWatch agent consuming excessive resources after a misconfigured metrics collection interval of 1 second instead of 60 seconds.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "test",
            "alert_type": "HIGH_CPU",
            "severity": "MEDIUM",
            "resolution": "Updated CloudWatch agent config to set metrics_collection_interval to 60 seconds in /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json. Restarted agent with `sudo systemctl restart amazon-cloudwatch-agent`.",
            "resolved_at": _ts(5),
        },
    },
    {
        "incident_id": "seed-006",
        "text": "HIGH_CPU on auth-service. CPU spiked to 92% due to bcrypt password hashing with cost factor 15 during a bulk user import of 10,000 accounts.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "auth-service",
            "alert_type": "HIGH_CPU",
            "severity": "MEDIUM",
            "resolution": "Throttled the bulk import to process 50 users per batch with 2-second delays between batches. Reduced bcrypt cost factor from 15 to 12 for bulk operations. CPU dropped to 40%.",
            "resolved_at": _ts(20),
        },
    },
    {
        "incident_id": "seed-007",
        "text": "HIGH_CPU on metrics-service. CPU at 88% caused by Python process doing heavy JSON serialization for 500k metric data points in a single /metrics/history response without pagination.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "metrics-service",
            "alert_type": "HIGH_CPU",
            "severity": "MEDIUM",
            "resolution": "Added pagination to /metrics/history endpoint (default limit=1000, max=5000). Switched from json.dumps to orjson for 5x faster serialization. CPU normalized to 20%.",
            "resolved_at": _ts(25),
        },
    },
    {
        "incident_id": "seed-008",
        "text": "HIGH_CPU alert on nginx-proxy. CPU at 86% due to SSL/TLS handshake storms after enabling TLS 1.3 without session ticket caching. Every request was doing a full handshake.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "nginx-proxy",
            "alert_type": "HIGH_CPU",
            "severity": "MEDIUM",
            "resolution": "Enabled SSL session caching in nginx.conf: `ssl_session_cache shared:SSL:50m; ssl_session_timeout 1d; ssl_session_tickets on;`. Reloaded nginx with `nginx -s reload`. CPU dropped to 12%.",
            "resolved_at": _ts(30),
        },
    },

    # ── HIGH RAM / OOM (6 incidents) ──────────────────────────────────────
    {
        "incident_id": "seed-009",
        "text": "HIGH_RAM alert on api-gateway. RAM at 93% — container was OOM-killed twice. Java heap growing unbounded due to an in-memory cache with no eviction policy.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "api-gateway",
            "alert_type": "HIGH_RAM",
            "severity": "CRITICAL",
            "resolution": "Added LRU eviction with max 10,000 entries to the response cache using Caffeine library. Set JVM heap max to 512MB with `-Xmx512m`. Increased container memory limit from 512MB to 1GB in docker-compose.yml and restarted with `docker compose up -d --force-recreate api-gateway`.",
            "resolved_at": _ts(2),
        },
    },
    {
        "incident_id": "seed-010",
        "text": "HIGH_RAM on database-proxy. RAM at 90% due to PostgreSQL connection pool not releasing idle connections. 450 connections open but only 20 active.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "database-proxy",
            "alert_type": "HIGH_RAM",
            "severity": "HIGH",
            "resolution": "Configured PgBouncer idle_timeout from 0 (never) to 300 seconds. Set max_client_conn=200 and default_pool_size=25. Restarted PgBouncer and idle connections were released within 5 minutes. RAM dropped to 45%.",
            "resolved_at": _ts(8),
        },
    },
    {
        "incident_id": "seed-011",
        "text": "HIGH_RAM on worker-service. RAM at 95% — Redis client library leaking connections. Each task was creating a new Redis connection without closing it.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "worker-service",
            "alert_type": "HIGH_RAM",
            "severity": "CRITICAL",
            "resolution": "Replaced per-task Redis connections with a shared connection pool (max 20 connections). Added `finally: redis.close()` to all task handlers. Restarted service. RAM stabilized at 40%.",
            "resolved_at": _ts(10),
        },
    },
    {
        "incident_id": "seed-012",
        "text": "HIGH_RAM on test EC2 instance. RAM at 87% due to multiple Docker containers running with no memory limits, all competing for the 1GB instance memory.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "test",
            "alert_type": "HIGH_RAM",
            "severity": "MEDIUM",
            "resolution": "Added memory limits to all containers in docker-compose.yml (deploy.resources.limits.memory). Set ai-engine to 384MB, metrics-service to 256MB, and auth-service to 256MB. Restarted all services with `docker compose up -d`.",
            "resolved_at": _ts(4),
        },
    },
    {
        "incident_id": "seed-013",
        "text": "HIGH_RAM on reporting-service. RAM at 91% caused by loading an entire 2GB CSV dataset into memory for report generation instead of streaming it.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "reporting-service",
            "alert_type": "HIGH_RAM",
            "severity": "HIGH",
            "resolution": "Refactored report generation to use pandas chunked reading with `chunksize=10000`. Processed each chunk and wrote results incrementally to the output file. RAM usage dropped from 2.1GB to 180MB.",
            "resolved_at": _ts(18),
        },
    },
    {
        "incident_id": "seed-014",
        "text": "HIGH_RAM on cache-service. RAM at 96% — Redis maxmemory not configured, and the cache was growing unbounded with no TTL on cached objects.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "cache-service",
            "alert_type": "HIGH_RAM",
            "severity": "CRITICAL",
            "resolution": "Set Redis maxmemory to 256MB and maxmemory-policy to allkeys-lru in redis.conf. Added default TTL of 3600 seconds to all SET operations in the application code. Memory stabilized at 240MB.",
            "resolved_at": _ts(6),
        },
    },

    # ── DISK FULL (5 incidents) ──────────────────────────────────────────
    {
        "incident_id": "seed-015",
        "text": "HIGH_DISK alert on web-frontend. Disk at 94% caused by application log files not being rotated. /var/log/app/ contained 45GB of uncompressed JSON logs spanning 6 months.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "web-frontend",
            "alert_type": "HIGH_DISK",
            "severity": "HIGH",
            "resolution": "Configured logrotate for the application logs: daily rotation, 7 days retention, gzip compression. Ran `logrotate -f /etc/logrotate.d/app` to immediately rotate. Cleaned old logs with `find /var/log/app/ -name '*.log' -mtime +7 -delete`. Freed 42GB.",
            "resolved_at": _ts(9),
        },
    },
    {
        "incident_id": "seed-016",
        "text": "HIGH_DISK on test EC2 instance. Disk at 92% due to Docker images and layers accumulating. `docker system df` showed 18GB used by unused images and build cache.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "test",
            "alert_type": "HIGH_DISK",
            "severity": "MEDIUM",
            "resolution": "Ran `docker system prune -af --volumes` to remove all unused images, containers, networks, and volumes. Freed 18GB. Added a weekly cron job: `0 3 * * 0 docker system prune -af >> /var/log/docker-prune.log 2>&1`.",
            "resolved_at": _ts(11),
        },
    },
    {
        "incident_id": "seed-017",
        "text": "HIGH_DISK on database-primary. Disk at 97% due to WAL (Write-Ahead Log) files accumulating after a failed replica that stopped consuming WAL segments. 25GB of WAL files in pg_wal/.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "database-primary",
            "alert_type": "HIGH_DISK",
            "severity": "CRITICAL",
            "resolution": "Identified the stale replication slot with `SELECT slot_name, active FROM pg_replication_slots`. Dropped the inactive slot: `SELECT pg_drop_replication_slot('replica_slot_1')`. PostgreSQL auto-cleaned 25GB of WAL files. Set max_wal_size=2GB to prevent future accumulation.",
            "resolved_at": _ts(1),
        },
    },
    {
        "incident_id": "seed-018",
        "text": "HIGH_DISK on worker-service. Disk at 89% caused by temporary files from failed job processing not being cleaned up. /tmp/job_artifacts/ had 12GB of stale files.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "worker-service",
            "alert_type": "HIGH_DISK",
            "severity": "MEDIUM",
            "resolution": "Added cleanup logic to the job failure handler to delete temporary artifacts. Ran `find /tmp/job_artifacts/ -mtime +1 -delete` to clean existing files. Added a systemd timer to clean /tmp daily.",
            "resolved_at": _ts(22),
        },
    },
    {
        "incident_id": "seed-019",
        "text": "HIGH_DISK alert on logging-service. Disk at 95% due to Elasticsearch indices growing without an ILM (Index Lifecycle Management) policy. Indices older than 90 days were never deleted.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "logging-service",
            "alert_type": "HIGH_DISK",
            "severity": "HIGH",
            "resolution": "Created an ILM policy with hot (7 days), warm (30 days), delete (60 days) phases. Applied to all log-* indices. Manually deleted indices older than 60 days with `curl -X DELETE 'localhost:9200/log-2024.*'`. Freed 35GB.",
            "resolved_at": _ts(14),
        },
    },

    # ── SERVICE DOWN / CRASH LOOP (6 incidents) ──────────────────────────
    {
        "incident_id": "seed-020",
        "text": "SERVICE_DOWN alert on auth-service. Container in crash loop (CrashLoopBackOff). Service fails to start after latest deployment — missing DATABASE_URL environment variable after .env file was accidentally excluded from the deploy.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "auth-service",
            "alert_type": "SERVICE_DOWN",
            "severity": "CRITICAL",
            "resolution": "Added the missing DATABASE_URL to the container's environment section in docker-compose.yml. Verified with `docker compose config | grep DATABASE_URL`. Restarted with `docker compose up -d auth-service`. Service came up healthy.",
            "resolved_at": _ts(1),
        },
    },
    {
        "incident_id": "seed-021",
        "text": "SERVICE_DOWN on payment-service. Service crashes on startup with 'EADDRINUSE: port 3000 already in use'. Another container was already bound to port 3000 after a failed rolling update left the old container running.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "payment-service",
            "alert_type": "SERVICE_DOWN",
            "severity": "CRITICAL",
            "resolution": "Identified the conflicting container with `docker ps | grep 3000`. Stopped the old container: `docker stop payment-service-old`. Started the new container. Changed port mapping to use a unique host port (3001:3000) to prevent future conflicts.",
            "resolved_at": _ts(2),
        },
    },
    {
        "incident_id": "seed-022",
        "text": "SERVICE_DOWN on api-gateway. Service fails to start due to upstream dependency (Redis) not being available. Health check fails because Redis connection times out after 5 seconds.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "api-gateway",
            "alert_type": "SERVICE_DOWN",
            "severity": "HIGH",
            "resolution": "Added `depends_on: redis: condition: service_healthy` to docker-compose.yml for api-gateway. Added a health check to the Redis container. Configured retry logic with exponential backoff (3 attempts, 5s/10s/20s delays) in the application's Redis client initialization.",
            "resolved_at": _ts(5),
        },
    },
    {
        "incident_id": "seed-023",
        "text": "SERVICE_DOWN on metrics-service. Container exits immediately with 'ModuleNotFoundError: No module named psycopg2'. The requirements.txt had psycopg2 but the Dockerfile was missing the libpq-dev build dependency.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "metrics-service",
            "alert_type": "SERVICE_DOWN",
            "severity": "HIGH",
            "resolution": "Changed psycopg2 to psycopg2-binary in requirements.txt (no build dependencies needed). Alternatively added `RUN apt-get update && apt-get install -y libpq-dev gcc` to the Dockerfile. Rebuilt with `docker compose build metrics-service && docker compose up -d metrics-service`.",
            "resolved_at": _ts(13),
        },
    },
    {
        "incident_id": "seed-024",
        "text": "SERVICE_DOWN on notification-service. Bad deployment — the latest Docker image has a syntax error in the config file. Container restarts 5 times in 2 minutes then enters CrashLoopBackOff.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "notification-service",
            "alert_type": "SERVICE_DOWN",
            "severity": "CRITICAL",
            "resolution": "Rolled back to the previous image tag: `docker compose pull notification-service` with the previous tag pinned in docker-compose.yml. Restarted with `docker compose up -d notification-service`. Filed a bug for the config syntax error in the latest build.",
            "resolved_at": _ts(3),
        },
    },
    {
        "incident_id": "seed-025",
        "text": "SERVICE_DOWN on scheduler-service. Service starts but becomes unresponsive after 10 minutes. Health check endpoint returns 503. Thread deadlock detected in the job scheduling mutex.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "scheduler-service",
            "alert_type": "SERVICE_DOWN",
            "severity": "HIGH",
            "resolution": "Took a thread dump with `kill -3 <pid>` and identified the deadlock between the scheduler mutex and the database connection pool lock. Refactored to use asyncio locks instead of threading locks. Added a 30-second watchdog timer that restarts the scheduler if it becomes unresponsive.",
            "resolved_at": _ts(16),
        },
    },

    # ── HIGH LATENCY / SLOW RESPONSES (6 incidents) ──────────────────────
    {
        "incident_id": "seed-026",
        "text": "HIGH_LATENCY alert on api-gateway. P99 latency at 4.2 seconds (normally 200ms). Root cause: N+1 query problem in the /users endpoint — fetching 100 users then making 100 individual queries for their profiles.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "api-gateway",
            "alert_type": "HIGH_LATENCY",
            "severity": "HIGH",
            "resolution": "Replaced the N+1 query pattern with a single JOIN query: `SELECT u.*, p.* FROM users u LEFT JOIN profiles p ON u.id = p.user_id WHERE u.id IN (...)`. P99 latency dropped from 4.2s to 150ms.",
            "resolved_at": _ts(7),
        },
    },
    {
        "incident_id": "seed-027",
        "text": "HIGH_LATENCY on search-service. Search queries taking 8-12 seconds. Elasticsearch missing an index on the 'tags' field, causing full collection scans on filtered searches.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "search-service",
            "alert_type": "HIGH_LATENCY",
            "severity": "MEDIUM",
            "resolution": "Created the missing Elasticsearch index mapping for the 'tags' field as keyword type. Reindexed the collection with `POST /search-index/_update_by_query`. Search latency dropped from 8s to 50ms.",
            "resolved_at": _ts(19),
        },
    },
    {
        "incident_id": "seed-028",
        "text": "HIGH_LATENCY on payment-service. Payment processing taking 15+ seconds. Downstream payment gateway API timing out due to their scheduled maintenance window, but our timeout was set to 30s with no circuit breaker.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "payment-service",
            "alert_type": "HIGH_LATENCY",
            "severity": "HIGH",
            "resolution": "Reduced HTTP timeout to 5 seconds. Implemented a circuit breaker pattern (open after 5 failures, half-open after 30s). Added a fallback queue for failed payments to retry after the maintenance window. Response time for failed payments dropped to 5s with immediate user feedback.",
            "resolved_at": _ts(21),
        },
    },
    {
        "incident_id": "seed-029",
        "text": "HIGH_LATENCY on database-proxy. All database queries slow (3-5x normal). Connection pool exhausted — max_connections=25 but 40 concurrent requests trying to acquire connections, causing a 10-second wait queue.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "database-proxy",
            "alert_type": "HIGH_LATENCY",
            "severity": "HIGH",
            "resolution": "Increased PgBouncer max_client_conn from 25 to 100 and default_pool_size from 10 to 30. Added connection timeout of 5 seconds to prevent indefinite waits. Restarted PgBouncer. Query latencies returned to normal within 30 seconds.",
            "resolved_at": _ts(4),
        },
    },
    {
        "incident_id": "seed-030",
        "text": "HIGH_LATENCY on web-frontend. Page load time increased from 1.5s to 8s. Unminified JavaScript bundle size grew to 12MB after adding a large charting library with all locales included.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "web-frontend",
            "alert_type": "HIGH_LATENCY",
            "severity": "MEDIUM",
            "resolution": "Configured tree-shaking and code splitting in webpack config. Imported only the required chart components instead of the full library. Added dynamic imports for locale data. Bundle size reduced from 12MB to 1.8MB. Page load time back to 1.6s.",
            "resolved_at": _ts(28),
        },
    },
    {
        "incident_id": "seed-031",
        "text": "HIGH_LATENCY on test EC2 instance. SSH and API responses slow (5-10s). Instance CPU steal time at 15%, indicating the underlying hypervisor is overloaded (noisy neighbor problem on t3.micro).",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "test",
            "alert_type": "HIGH_LATENCY",
            "severity": "MEDIUM",
            "resolution": "Stopped and started the instance (not just reboot) to migrate to a different hypervisor: `aws ec2 stop-instances --instance-ids i-xxx && aws ec2 start-instances --instance-ids i-xxx`. CPU steal time dropped to 0.5%. Alternatively, could upgrade to a dedicated/reserved instance.",
            "resolved_at": _ts(8),
        },
    },

    # ── KAFKA / QUEUE ISSUES (5 incidents) ────────────────────────────────
    {
        "incident_id": "seed-032",
        "text": "Consumer lag alert on order-processing topic. Kafka consumer group 'order-processor' has lag of 50,000 messages. Consumers are processing but can't keep up with producer rate after a batch import.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "order-service",
            "alert_type": "HIGH_LATENCY",
            "severity": "HIGH",
            "resolution": "Scaled order-processor consumers from 2 to 8 instances. Increased max.poll.records from 500 to 2000. Optimized the order processing logic to batch database writes (50 orders per transaction instead of 1). Lag cleared in 12 minutes.",
            "resolved_at": _ts(6),
        },
    },
    {
        "incident_id": "seed-033",
        "text": "Kafka partition rebalance storm on event-stream topic. Consumer group constantly rebalancing every 30 seconds. Processing effectively halted as consumers keep losing and regaining partitions.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "event-processor",
            "alert_type": "SERVICE_DOWN",
            "severity": "CRITICAL",
            "resolution": "Increased session.timeout.ms from 10000 to 30000 and heartbeat.interval.ms from 3000 to 10000. Set max.poll.interval.ms to 600000 (10 min) for long-running consumers. Switched to cooperative-sticky partition assignment strategy. Rebalancing stopped.",
            "resolved_at": _ts(2),
        },
    },
    {
        "incident_id": "seed-034",
        "text": "Kafka broker disk pressure warning. Broker log.dirs partition at 88% used. Topic retention set to 7 days but high-throughput topics generating 5GB/day.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "kafka-broker",
            "alert_type": "HIGH_DISK",
            "severity": "MEDIUM",
            "resolution": "Reduced retention for high-throughput topics from 7 days to 3 days: `kafka-configs --alter --topic events --add-config retention.ms=259200000`. Enabled log compaction for changelog topics. Freed 15GB immediately after retention cleanup ran.",
            "resolved_at": _ts(17),
        },
    },
    {
        "incident_id": "seed-035",
        "text": "Dead letter queue filling up on notification-topic. 2,000 messages in DLQ in the last hour. Consumer failing to deserialize messages after a schema change (added a required field without default value).",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "notification-service",
            "alert_type": "HIGH_LATENCY",
            "severity": "HIGH",
            "resolution": "Updated the Avro schema to make the new field optional with a default value. Deployed the updated consumer. Replayed the 2,000 DLQ messages with `kafka-console-consumer --topic notification-topic-dlq | kafka-console-producer --topic notification-topic`. All messages processed successfully.",
            "resolved_at": _ts(9),
        },
    },
    {
        "incident_id": "seed-036",
        "text": "Kafka producer timeout errors on audit-log topic. Producers getting TimeoutException after 30 seconds. Broker under-replicated partitions detected — one of three brokers is offline.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "audit-service",
            "alert_type": "SERVICE_DOWN",
            "severity": "CRITICAL",
            "resolution": "Restarted the failed Kafka broker (broker-2) with `docker compose restart kafka-2`. Verified ISR (In-Sync Replicas) recovered with `kafka-topics --describe --topic audit-log`. Temporarily set acks=1 (instead of acks=all) to allow producers to continue while broker-2 caught up. Reverted acks=all after ISR fully synced.",
            "resolved_at": _ts(1),
        },
    },

    # ── DATABASE ISSUES (5 incidents) ─────────────────────────────────────
    {
        "incident_id": "seed-037",
        "text": "Database connection pool exhaustion on user-service. All 50 connections in use, new requests waiting 30+ seconds. Long-running transactions from the admin panel holding connections for minutes.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "user-service",
            "alert_type": "HIGH_LATENCY",
            "severity": "HIGH",
            "resolution": "Identified long-running transactions with `SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE state != 'idle' ORDER BY duration DESC`. Terminated the 3 longest queries: `SELECT pg_terminate_backend(<pid>)`. Added statement_timeout=30000 (30s) to prevent future long queries.",
            "resolved_at": _ts(3),
        },
    },
    {
        "incident_id": "seed-038",
        "text": "Database lock contention on inventory-service. UPDATE queries on the 'products' table taking 10+ seconds due to row-level locks from concurrent stock updates.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "inventory-service",
            "alert_type": "HIGH_LATENCY",
            "severity": "MEDIUM",
            "resolution": "Replaced row-level locking with advisory locks for stock updates. Implemented optimistic concurrency control using a version column. Batch-processed concurrent updates using `FOR UPDATE SKIP LOCKED`. Lock contention dropped to near zero.",
            "resolved_at": _ts(24),
        },
    },
    {
        "incident_id": "seed-039",
        "text": "Slow database migration on order-service. ALTER TABLE on the 'orders' table (50M rows) running for 4 hours, blocking all writes. The migration added a new column with a default value, requiring a full table rewrite.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "order-service",
            "alert_type": "HIGH_LATENCY",
            "severity": "HIGH",
            "resolution": "Cancelled the running migration. Used `ALTER TABLE orders ADD COLUMN new_field TEXT` (without DEFAULT) which is instant in PostgreSQL. Then backfilled in batches of 10,000 rows: `UPDATE orders SET new_field = 'default' WHERE id BETWEEN $1 AND $2`. Total migration time reduced from 4 hours to 15 minutes with zero downtime.",
            "resolved_at": _ts(35),
        },
    },
    {
        "incident_id": "seed-040",
        "text": "Database replica lag on analytics-service. Read replica 2.5 minutes behind primary. Analytics queries returning stale data. Replica WAL receiver process consuming 100% CPU on the replica instance.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "analytics-service",
            "alert_type": "HIGH_LATENCY",
            "severity": "MEDIUM",
            "resolution": "Identified that the replica was replaying a large batch of WAL from a bulk data load. Increased wal_receiver_timeout to 120s and max_wal_senders to 10 on the primary. After the bulk load completed, lag recovered to under 1 second. Added monitoring alert for replica lag > 30 seconds.",
            "resolved_at": _ts(27),
        },
    },
    {
        "incident_id": "seed-041",
        "text": "PostgreSQL out of shared memory on test instance. Error: 'could not resize shared memory segment'. Database refusing new connections. max_locks_per_transaction too low for a large schema migration.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "test",
            "alert_type": "SERVICE_DOWN",
            "severity": "HIGH",
            "resolution": "Increased max_locks_per_transaction from 64 to 256 in postgresql.conf. Increased shared_buffers from 128MB to 256MB. Restarted PostgreSQL with `sudo systemctl restart postgresql`. Migration completed successfully after restart.",
            "resolved_at": _ts(10),
        },
    },

    # ── DOCKER / CONTAINER ISSUES (5 incidents) ──────────────────────────
    {
        "incident_id": "seed-042",
        "text": "Docker container health check failing on ai-engine. Container marked unhealthy after 3 consecutive failed health checks. The /health endpoint returns 503 because the Pinecone connection timed out during startup.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "ai-engine",
            "alert_type": "SERVICE_DOWN",
            "severity": "MEDIUM",
            "resolution": "Increased health check start_period from 10s to 60s in docker-compose.yml to give the service time to initialize Pinecone and load the ML model. Updated the /health endpoint to return 200 even if Pinecone is disconnected (degraded mode). Container now starts reliably.",
            "resolved_at": _ts(5),
        },
    },
    {
        "incident_id": "seed-043",
        "text": "Docker image too large for CI/CD pipeline. ai-engine image is 3.2GB due to including full PyTorch installation and model weights. Build takes 15 minutes and deployment timeout at 5 minutes.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "ai-engine",
            "alert_type": "HIGH_LATENCY",
            "severity": "LOW",
            "resolution": "Switched to python:3.11-slim base image. Used multi-stage build to separate build and runtime stages. Installed only sentence-transformers (not full PyTorch). Added .dockerignore for tests/, docs/, and __pycache__. Image size reduced from 3.2GB to 890MB. Build time down to 4 minutes.",
            "resolved_at": _ts(32),
        },
    },
    {
        "incident_id": "seed-044",
        "text": "Zombie processes accumulating in worker-service container. PID count growing steadily — 450 zombie processes after 48 hours. Container's init system not reaping child processes.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "worker-service",
            "alert_type": "HIGH_RAM",
            "severity": "MEDIUM",
            "resolution": "Added `init: true` to the worker-service in docker-compose.yml to use tini as PID 1 init process for proper zombie reaping. Alternatively added `--init` flag to docker run. Restarted container — zombie count stays at 0.",
            "resolved_at": _ts(40),
        },
    },
    {
        "incident_id": "seed-045",
        "text": "Docker bridge network connectivity issue. Containers on the same network cannot resolve each other by service name. DNS resolution returning NXDOMAIN for service names.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "api-gateway",
            "alert_type": "SERVICE_DOWN",
            "severity": "CRITICAL",
            "resolution": "Docker's embedded DNS server was corrupted. Recreated the Docker network: `docker network rm app-network && docker network create app-network`. Restarted all containers with `docker compose down && docker compose up -d`. DNS resolution restored immediately.",
            "resolved_at": _ts(1),
        },
    },
    {
        "incident_id": "seed-046",
        "text": "Container filesystem read-only error on logging-service. Application fails to write log files with 'Read-only file system' error. Docker overlay2 storage driver corruption after an unclean host shutdown.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "logging-service",
            "alert_type": "SERVICE_DOWN",
            "severity": "HIGH",
            "resolution": "Stopped the container. Ran `docker system prune` to clean up corrupted layers. Removed and recreated the container: `docker compose rm -f logging-service && docker compose up -d logging-service`. Added a named volume for /var/log/app to persist logs across container recreations.",
            "resolved_at": _ts(2),
        },
    },

    # ── AWS / EC2 SPECIFIC (4 incidents) ──────────────────────────────────
    {
        "incident_id": "seed-047",
        "text": "EC2 security group misconfiguration on test instance. Application accessible on port 8080 from the internet (0.0.0.0/0) instead of VPC-only access. Detected during security audit.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "test",
            "alert_type": "HIGH_LATENCY",
            "severity": "HIGH",
            "resolution": "Updated the security group to restrict port 8080 inbound to the VPC CIDR (10.0.0.0/16) only: `aws ec2 revoke-security-group-ingress --group-id sg-xxx --protocol tcp --port 8080 --cidr 0.0.0.0/0` then `aws ec2 authorize-security-group-ingress --group-id sg-xxx --protocol tcp --port 8080 --cidr 10.0.0.0/16`. Added AWS Config rule to detect future public port exposures.",
            "resolved_at": _ts(3),
        },
    },
    {
        "incident_id": "seed-048",
        "text": "EBS volume full on production EC2 instance. Root volume (20GB gp2) at 98% used. Instance becomes unresponsive because /tmp is full and systemd can't create temp files.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "prod-web",
            "alert_type": "HIGH_DISK",
            "severity": "CRITICAL",
            "resolution": "Expanded the EBS volume from 20GB to 50GB via AWS Console. Extended the filesystem: `sudo growpart /dev/xvda 1 && sudo resize2fs /dev/xvda1`. Cleaned /tmp with `sudo find /tmp -mtime +3 -delete`. Set up CloudWatch alarm for disk > 80% to prevent recurrence.",
            "resolved_at": _ts(1),
        },
    },
    {
        "incident_id": "seed-049",
        "text": "IAM permission denied on metrics-service trying to call CloudWatch GetMetricData. Error: 'User: arn:aws:iam::xxx:role/MetricsRole is not authorized to perform: cloudwatch:GetMetricData'. Role policy missing the cloudwatch:GetMetricData action.",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "metrics-service",
            "alert_type": "SERVICE_DOWN",
            "severity": "HIGH",
            "resolution": "Updated the IAM role policy to include cloudwatch:GetMetricData and cloudwatch:ListMetrics actions: `aws iam put-role-policy --role-name MetricsRole --policy-name CloudWatchRead --policy-document file://policy.json`. Waited 30 seconds for IAM propagation. Metrics collection resumed.",
            "resolved_at": _ts(6),
        },
    },
    {
        "incident_id": "seed-050",
        "text": "CloudWatch agent not reporting metrics on test EC2 instance. Agent installed but not running. systemd service failed to start because the config file had invalid JSON (trailing comma).",
        "metadata": {
            "user_id": DEFAULT_USER_ID,
            "service_name": "test",
            "alert_type": "SERVICE_DOWN",
            "severity": "MEDIUM",
            "resolution": "Validated the CloudWatch agent config with `amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -s`. Fixed the trailing comma in the JSON config. Restarted with `sudo systemctl restart amazon-cloudwatch-agent`. Metrics appeared in CloudWatch within 2 minutes.",
            "resolved_at": _ts(12),
        },
    },
]


async def main():
    print(f"Initializing vector store (index: '{settings.pinecone_index_name}')...")
    vector_store = VectorStore()
    await vector_store.init()

    if not vector_store.connected:
        print("❌ Failed to connect to Pinecone. Check PINECONE_API_KEY and network connectivity.")
        return

    print(f"Connected to Pinecone. Seeding {len(seed_incidents)} incidents...\n")

    for incident in seed_incidents:
        await vector_store.upsert_incident(
            incident_id=incident["incident_id"],
            text=incident["text"],
            metadata=incident["metadata"],
        )
        print(f"  Seeded: {incident['incident_id']} — {incident['metadata']['alert_type']} on {incident['metadata']['service_name']}")

    print(f"\n✅ Seeded {len(seed_incidents)} incidents into Pinecone index '{settings.pinecone_index_name}'")


if __name__ == "__main__":
    asyncio.run(main())
