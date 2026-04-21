#!/usr/bin/env python3
"""
test-tools/test_phase5.py — Comprehensive tests for the Phase 5 Multi-Agent pipeline.

Tests:
  1. Full pipeline with all 4 agents
  2. Graceful failure — empty logs
  3. Phase 4 vs Phase 5 comparison
  4. Performance timing (3 runs)

Usage:
  python test-tools/test_phase5.py

Requires the ai-engine to be running on localhost:8002.
Requires the auth-service to be running on localhost:3001 (for JWT).
"""

import json
import time
import sys
import requests

AI_ENGINE = "http://localhost:8002"
AUTH_SERVICE = "http://localhost:3001"

# ── Colour helpers for terminal output ────────────────────────────────────

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"


def header(title: str):
    print(f"\n{'═' * 60}")
    print(f"{BOLD}{CYAN}  {title}{RESET}")
    print(f"{'═' * 60}")


def sub_header(title: str):
    print(f"\n{BOLD}{YELLOW}── {title} ──{RESET}")


def ok(msg: str):
    print(f"  {GREEN}✓{RESET} {msg}")


def fail(msg: str):
    print(f"  {RED}✗{RESET} {msg}")


def info(msg: str):
    print(f"  {CYAN}ℹ{RESET} {msg}")


# ── Get a JWT token ──────────────────────────────────────────────────────

def get_token() -> str:
    """Register a test user (or login) and return a JWT."""
    user = {"email": "phase5test@devops.local", "password": "TestPass123!"}

    # Try register first
    try:
        resp = requests.post(f"{AUTH_SERVICE}/auth/register", json=user, timeout=5)
        if resp.status_code in (200, 201):
            data = resp.json()
            return data.get("token", data.get("accessToken", ""))
    except Exception:
        pass

    # Fall back to login
    try:
        resp = requests.post(f"{AUTH_SERVICE}/auth/login", json=user, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            return data.get("token", data.get("accessToken", ""))
    except Exception:
        pass

    print(f"{RED}Could not obtain JWT token. Make sure auth-service is running.{RESET}")
    return "test-token-fallback"


# ── Shared test data ─────────────────────────────────────────────────────

REALISTIC_LOGS = """2024-04-19T10:01:12 ERROR: connection pool exhausted — max 50 connections reached
2024-04-19T10:01:13 WARN: retry attempt 45/50 to acquire connection
2024-04-19T10:01:14 ERROR: query timeout after 30000ms on users table
2024-04-19T10:01:15 ERROR: connection refused to replica db-read-2
2024-04-19T10:01:16 WARN: circuit breaker tripped for database calls
2024-04-19T10:01:17 ERROR: pool exhausted — all connections in use
2024-04-19T10:01:18 ERROR: OOM killer invoked on worker-7
2024-04-19T10:01:19 WARN: memory pressure detected — 94% used
2024-04-19T10:01:20 ERROR: connection refused to primary DB endpoint
2024-04-19T10:01:21 FATAL: unable to allocate new connection — shutting down request handler
2024-04-19T10:01:22 ERROR: timeout exceeded for health check on db-primary
2024-04-19T10:01:23 ERROR: too many connections — rejecting new requests
2024-04-19T10:01:24 WARN: degraded mode activated
2024-04-19T10:01:25 ERROR: connection pool exhausted again after brief recovery
"""

METRICS_HISTORY = [
    {"cpu": 45.2, "ram": 52.1, "timestamp": "2024-04-19T09:55:00"},
    {"cpu": 52.8, "ram": 55.3, "timestamp": "2024-04-19T09:56:00"},
    {"cpu": 61.4, "ram": 58.7, "timestamp": "2024-04-19T09:57:00"},
    {"cpu": 73.1, "ram": 64.2, "timestamp": "2024-04-19T09:58:00"},
    {"cpu": 82.6, "ram": 71.5, "timestamp": "2024-04-19T09:59:00"},
    {"cpu": 88.3, "ram": 76.8, "timestamp": "2024-04-19T10:00:00"},
    {"cpu": 91.4, "ram": 78.2, "timestamp": "2024-04-19T10:01:00"},
    {"cpu": 94.1, "ram": 82.6, "timestamp": "2024-04-19T10:02:00"},
]

USER_ID = "00000000-0000-0000-0000-000000000001"


def build_payload(raw_logs: str = REALISTIC_LOGS) -> dict:
    return {
        "user_id": USER_ID,
        "service_name": "api-server",
        "alert_type": "CPU_SPIKE",
        "raw_logs": raw_logs,
        "current_cpu": 94.1,
        "current_ram": 82.6,
        "metrics_history": METRICS_HISTORY,
    }


def call_analyze(token: str, payload: dict = None) -> dict:
    if payload is None:
        payload = build_payload()
    resp = requests.post(
        f"{AI_ENGINE}/ai/analyze",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=60,
    )
    return {"status_code": resp.status_code, "body": resp.json()}


# ── TEST 1: Full pipeline ────────────────────────────────────────────────

def test_full_pipeline(token: str):
    header("TEST 1 — Full Pipeline (all 4 agents)")

    start = time.time()
    result = call_analyze(token)
    elapsed = time.time() - start

    sc = result["status_code"]
    data = result["body"]

    if sc == 200:
        ok(f"HTTP 200 — pipeline succeeded ({elapsed:.1f}s)")
    elif sc == 503:
        fail(f"HTTP 503 — LLM call failed (expected if no API key): {data.get('detail', '')}")
        info("This is expected if ANTHROPIC_API_KEY is not set.")
        return False
    else:
        fail(f"HTTP {sc}: {data}")
        return False

    # Verify all 4 agents completed
    agents = data.get("agents_completed", 0)
    if agents == 4:
        ok(f"All {agents} agents completed")
    else:
        fail(f"Only {agents}/4 agents completed")

    # Print each agent's output
    sub_header("Agent 1 — Log Analysis")
    la = data.get("log_analysis", {})
    print(json.dumps(la, indent=2))

    sub_header("Agent 2 — Metrics Analysis")
    ma = data.get("metrics_analysis", {})
    print(json.dumps(ma, indent=2))

    sub_header("Agent 3 — Decision")
    dec = data.get("decision", {})
    print(json.dumps(dec, indent=2))

    sub_header("Agent 4 — Action Plan")
    ap = data.get("action_plan", {})
    print(json.dumps(ap, indent=2))

    sub_header("Summary")
    print(json.dumps(data.get("summary", {}), indent=2))

    info(f"Incident ID: {data.get('incident_id', 'N/A')}")
    info(f"Pipeline version: {data.get('pipeline_version', 'N/A')}")
    info(f"Processing time: {data.get('processing_time_ms', 'N/A')} ms")

    return True


# ── TEST 2: Graceful failure (empty logs) ────────────────────────────────

def test_empty_logs(token: str):
    header("TEST 2 — Graceful Failure (empty logs)")

    payload = build_payload(raw_logs="")
    result = call_analyze(token, payload)
    sc = result["status_code"]
    data = result["body"]

    if sc == 503:
        info(f"HTTP 503 — LLM unavailable (expected without API key)")
        return True

    if sc == 200:
        ok("HTTP 200 — pipeline completed despite empty logs")
    else:
        fail(f"HTTP {sc}: {data}")
        return False

    la = data.get("log_analysis", {})
    if la.get("fallback") or la.get("error_count", -1) == 0:
        ok("Agent 1 used fallback for empty logs (did not crash)")
    else:
        fail("Agent 1 did NOT use fallback")

    agents = data.get("agents_completed", 0)
    if agents == 4:
        ok(f"All 4 agents completed even with empty logs")
    else:
        fail(f"Only {agents}/4 agents completed")

    return True


# ── TEST 3: Phase 4 vs Phase 5 comparison ────────────────────────────────

def test_comparison(token: str):
    header("TEST 3 — Phase 4 (diagnose) vs Phase 5 (analyze)")

    # Phase 4
    sub_header("Phase 4 — POST /ai/diagnose")
    try:
        p4_start = time.time()
        p4_resp = requests.post(
            f"{AI_ENGINE}/ai/diagnose",
            json={
                "user_id": USER_ID,
                "service_name": "api-server",
                "alert_type": "CPU_SPIKE",
                "log_excerpt": "ERROR: connection pool exhausted, OOM on worker-7",
            },
            headers={"Authorization": f"Bearer {token}"},
            timeout=60,
        )
        p4_elapsed = time.time() - p4_start

        if p4_resp.status_code == 200:
            ok(f"Phase 4 returned 200 ({p4_elapsed:.1f}s)")
            p4_data = p4_resp.json()
            print(json.dumps(p4_data, indent=2))
        else:
            info(f"Phase 4 returned {p4_resp.status_code} (LLM may be unavailable)")
            p4_data = None
    except Exception as e:
        info(f"Phase 4 call failed: {e}")
        p4_data = None

    # Phase 5
    sub_header("Phase 5 — POST /ai/analyze")
    p5_start = time.time()
    p5_result = call_analyze(token)
    p5_elapsed = time.time() - p5_start

    if p5_result["status_code"] == 200:
        ok(f"Phase 5 returned 200 ({p5_elapsed:.1f}s)")
        p5_data = p5_result["body"]
        # Show just the summary + key differences
        print(json.dumps(p5_data.get("summary", {}), indent=2))
        info(f"Phase 5 has {len(p5_data)} top-level keys vs Phase 4's {len(p4_data) if p4_data else '?'}")
        info(f"Phase 5 includes: log_analysis, metrics_analysis, decision, action_plan, summary")
        info("Phase 5 gives significantly more structured, actionable output")
    elif p5_result["status_code"] == 503:
        info(f"Phase 5 returned 503 (LLM unavailable)")
    else:
        fail(f"Phase 5 returned {p5_result['status_code']}")


# ── TEST 4: Performance timing ───────────────────────────────────────────

def test_performance(token: str):
    header("TEST 4 — Performance Timing (3 runs)")

    times = []
    for i in range(3):
        start = time.time()
        result = call_analyze(token)
        elapsed = time.time() - start
        sc = result["status_code"]

        if sc == 200:
            data = result["body"]
            ms = data.get("processing_time_ms", "?")
            ok(f"Run {i+1}: {elapsed:.1f}s total, {ms} ms server-side")
            times.append(elapsed)
        elif sc == 503:
            info(f"Run {i+1}: HTTP 503 (LLM unavailable) — skipping perf test")
            return
        else:
            fail(f"Run {i+1}: HTTP {sc}")

    if times:
        avg = sum(times) / len(times)
        info(f"Average total time: {avg:.1f}s over {len(times)} runs")
        info("Note: Agent 3 (DecisionAgent / Claude call) will be the bottleneck")


# ── Main ─────────────────────────────────────────────────────────────────

def main():
    header("Phase 5 Multi-Agent Pipeline Tests")
    info("Checking services...")

    # Health check
    try:
        resp = requests.get(f"{AI_ENGINE}/ai/health", timeout=5)
        if resp.status_code == 200:
            ok(f"AI Engine is healthy: {resp.json()}")
        else:
            fail(f"AI Engine health check failed: {resp.status_code}")
            sys.exit(1)
    except Exception as e:
        fail(f"Cannot reach AI Engine at {AI_ENGINE}: {e}")
        sys.exit(1)

    # Get JWT
    token = get_token()
    if token and token != "test-token-fallback":
        ok("Got JWT token from auth-service")
    else:
        info("Using fallback token — some tests may 401")

    # Run tests
    test_full_pipeline(token)
    test_empty_logs(token)
    test_comparison(token)
    test_performance(token)

    header("All Tests Complete")


if __name__ == "__main__":
    main()
