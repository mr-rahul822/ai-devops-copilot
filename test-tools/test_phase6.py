#!/usr/bin/env python3
"""
test-tools/test_phase6.py — Comprehensive tests for the Phase 6 Action Service.

Tests:
  1. Health check — verify Docker connected
  2. Fetch logs (LOW risk, no approval) — immediate execution
  3. Restart with approval flow — full lifecycle
  4. Rejection test — PENDING → REJECTED
  5. Audit trail verification — all events present

Usage:
  python test-tools/test_phase6.py

Requires:
  - action-service running on localhost:8003
  - auth-service running on localhost:3001
  - at least one container running (e.g. metrics-service)
"""

import json
import os
import sys
import time

# Force UTF-8 output on Windows terminals
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import requests

ACTION_SERVICE = "http://localhost:8003"
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
    user = {"email": "phase6test@devops.local", "password": "TestPass123!"}

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
    return ""


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


USER_ID = "00000000-0000-0000-0000-000000000001"


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 1 — Health check
# ═══════════════════════════════════════════════════════════════════════════════

def test_health(token: str) -> bool:
    header("TEST 1 — Health Check")

    try:
        resp = requests.get(
            f"{ACTION_SERVICE}/actions/health",
            headers=auth_headers(token),
            timeout=10,
        )
    except Exception as e:
        fail(f"Cannot reach action-service: {e}")
        return False

    if resp.status_code != 200:
        fail(f"Health check returned {resp.status_code}: {resp.text}")
        return False

    data = resp.json()
    ok(f"Status: {data.get('status')}")

    docker_status = data.get("docker", "unknown")
    if docker_status == "connected":
        ok(f"Docker: {docker_status}")
    else:
        fail(f"Docker: {docker_status}")

    info(f"AWS: {data.get('aws', 'unknown')}")
    info(f"Pending actions: {data.get('pending_actions', '?')}")

    return docker_status == "connected"


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 2 — Fetch container logs (LOW risk, no approval needed)
# ═══════════════════════════════════════════════════════════════════════════════

def test_fetch_logs(token: str) -> bool:
    header("TEST 2 — Fetch Container Logs (no approval)")

    payload = {
        "user_id": USER_ID,
        "action_type": "fetch_container_logs",
        "target_service": "metrics-service",
        "executor_type": "docker",
        "risk_level": "LOW",
        "requires_approval": False,
        "params": {"tail": 50},
    }

    sub_header("POST /actions/execute (fetch_container_logs)")
    try:
        start = time.time()
        resp = requests.post(
            f"{ACTION_SERVICE}/actions/execute",
            json=payload,
            headers=auth_headers(token),
            timeout=30,
        )
        elapsed = time.time() - start
    except Exception as e:
        fail(f"Request failed: {e}")
        return False

    if resp.status_code != 200:
        fail(f"HTTP {resp.status_code}: {resp.text}")
        return False

    data = resp.json()
    status = data.get("status")

    if status == "COMPLETED":
        ok(f"Action executed immediately — no approval needed ({elapsed:.1f}s)")
    else:
        fail(f"Expected COMPLETED, got {status}")
        return False

    result = data.get("result", {})
    details = result.get("details", {})
    line_count = details.get("line_count", 0)
    ok(f"Fetched {line_count} log lines from metrics-service")

    # Print first 5 lines of logs
    logs = details.get("logs", "")
    log_lines = logs.strip().splitlines()
    sub_header(f"Container Logs (first 5 of {len(log_lines)} lines)")
    for line in log_lines[:5]:
        print(f"    {line}")
    if len(log_lines) > 5:
        info(f"... and {len(log_lines) - 5} more lines")

    info(f"Action ID: {data.get('action_id')}")
    return True


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 3 — Restart with full approval flow
# ═══════════════════════════════════════════════════════════════════════════════

def test_restart_with_approval(token: str) -> str | None:
    header("TEST 3 — Restart Container (with approval)")

    # ── Step A: Request restart ───────────────────────────────────────
    sub_header("Step A — POST /actions/execute (restart_container)")
    payload = {
        "user_id": USER_ID,
        "action_type": "restart_container",
        "target_service": "metrics-service",
        "executor_type": "docker",
        "risk_level": "MEDIUM",
        "requires_approval": True,
        "params": {},
    }

    try:
        resp = requests.post(
            f"{ACTION_SERVICE}/actions/execute",
            json=payload,
            headers=auth_headers(token),
            timeout=10,
        )
    except Exception as e:
        fail(f"Request failed: {e}")
        return None

    if resp.status_code != 200:
        fail(f"HTTP {resp.status_code}: {resp.text}")
        return None

    data = resp.json()
    action_id = data.get("action_id")
    status = data.get("status")

    if status == "PENDING_APPROVAL":
        ok(f"Action created with PENDING_APPROVAL")
        ok(f"Action ID: {action_id}")
    else:
        fail(f"Expected PENDING_APPROVAL, got {status}")
        return None

    # ── Step B: Verify pending status ─────────────────────────────────
    sub_header("Step B — GET /actions/{id} (verify PENDING)")
    try:
        resp = requests.get(
            f"{ACTION_SERVICE}/actions/{action_id}",
            headers=auth_headers(token),
            timeout=10,
        )
    except Exception as e:
        fail(f"Request failed: {e}")
        return None

    if resp.status_code != 200:
        fail(f"HTTP {resp.status_code}: {resp.text}")
        return None

    detail = resp.json()
    action_status = detail["action"]["status"]
    if action_status == "PENDING_APPROVAL":
        ok(f"Confirmed: action is PENDING_APPROVAL")
    else:
        fail(f"Expected PENDING_APPROVAL, got {action_status}")
        return None

    info(f"Action type: {detail['action']['action_type']}")
    info(f"Target: {detail['action']['target_service']}")
    info(f"Risk: {detail['action']['risk_level']}")

    # ── Step C: Approve and execute ───────────────────────────────────
    sub_header("Step C — POST /actions/{id}/approve")
    info("Approving action... (container will actually restart)")
    try:
        start = time.time()
        resp = requests.post(
            f"{ACTION_SERVICE}/actions/{action_id}/approve",
            headers=auth_headers(token),
            timeout=60,
        )
        elapsed = time.time() - start
    except Exception as e:
        fail(f"Approve request failed: {e}")
        return None

    if resp.status_code != 200:
        fail(f"HTTP {resp.status_code}: {resp.text}")
        return None

    data = resp.json()
    if data.get("status") == "COMPLETED":
        ok(f"Container restarted successfully! ({elapsed:.1f}s)")
    elif data.get("status") == "FAILED":
        fail(f"Execution failed: {data.get('result', {}).get('message', '?')}")
        return action_id  # still return ID for audit trail test
    else:
        fail(f"Unexpected status: {data.get('status')}")
        return action_id

    result = data.get("result", {})
    details = result.get("details", {})
    info(f"Previous status: {details.get('previous_status', '?')}")
    info(f"New status: {details.get('new_status', '?')}")
    info(f"Executed at: {data.get('executed_at', '?')}")

    # ── Step D: Verify COMPLETED ──────────────────────────────────────
    sub_header("Step D — GET /actions/{id} (verify COMPLETED)")
    try:
        resp = requests.get(
            f"{ACTION_SERVICE}/actions/{action_id}",
            headers=auth_headers(token),
            timeout=10,
        )
    except Exception as e:
        fail(f"Request failed: {e}")
        return action_id

    if resp.status_code != 200:
        fail(f"HTTP {resp.status_code}: {resp.text}")
        return action_id

    detail = resp.json()
    final_status = detail["action"]["status"]
    if final_status == "COMPLETED":
        ok(f"Confirmed: action is COMPLETED")
    else:
        fail(f"Expected COMPLETED, got {final_status}")

    # Print audit trail
    trail = detail.get("audit_trail", [])
    sub_header(f"Audit Trail ({len(trail)} events)")
    for event in trail:
        print(f"    [{event['event_type']}] {event.get('event_detail', '')} — {event['timestamp']}")

    return action_id


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 4 — Rejection test
# ═══════════════════════════════════════════════════════════════════════════════

def test_rejection(token: str) -> bool:
    header("TEST 4 — Rejection Flow")

    # Create a restart action
    sub_header("Step A — Create action")
    payload = {
        "user_id": USER_ID,
        "action_type": "restart_container",
        "target_service": "metrics-service",
        "executor_type": "docker",
        "risk_level": "MEDIUM",
        "requires_approval": True,
        "params": {},
    }

    try:
        resp = requests.post(
            f"{ACTION_SERVICE}/actions/execute",
            json=payload,
            headers=auth_headers(token),
            timeout=10,
        )
    except Exception as e:
        fail(f"Request failed: {e}")
        return False

    if resp.status_code != 200:
        fail(f"HTTP {resp.status_code}: {resp.text}")
        return False

    data = resp.json()
    action_id = data.get("action_id")
    ok(f"Created action: {action_id}")

    # Reject it
    sub_header("Step B — Reject action")
    try:
        resp = requests.post(
            f"{ACTION_SERVICE}/actions/{action_id}/reject",
            json={"reason": "Test rejection — not needed right now"},
            headers=auth_headers(token),
            timeout=10,
        )
    except Exception as e:
        fail(f"Request failed: {e}")
        return False

    if resp.status_code != 200:
        fail(f"HTTP {resp.status_code}: {resp.text}")
        return False

    data = resp.json()
    if data.get("status") == "REJECTED":
        ok(f"Action REJECTED successfully")
    else:
        fail(f"Expected REJECTED, got {data.get('status')}")
        return False

    # Verify in DB
    sub_header("Step C — Verify in DB")
    try:
        resp = requests.get(
            f"{ACTION_SERVICE}/actions/{action_id}",
            headers=auth_headers(token),
            timeout=10,
        )
    except Exception as e:
        fail(f"Request failed: {e}")
        return False

    detail = resp.json()
    if detail["action"]["status"] == "REJECTED":
        ok("Confirmed: action is REJECTED in DB")
    else:
        fail(f"DB shows {detail['action']['status']}")
        return False

    trail = detail.get("audit_trail", [])
    event_types = [e["event_type"] for e in trail]
    info(f"Audit events: {event_types}")

    if "ACTION_REJECTED" in event_types:
        ok("ACTION_REJECTED event in audit trail")
    else:
        fail("Missing ACTION_REJECTED event")
        return False

    return True


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 5 — Audit trail verification
# ═══════════════════════════════════════════════════════════════════════════════

def test_audit_trail(token: str, action_id: str) -> bool:
    header("TEST 5 — Audit Trail Verification")

    if not action_id:
        fail("No action_id from TEST 3 — skipping")
        return False

    try:
        resp = requests.get(
            f"{ACTION_SERVICE}/actions/{action_id}",
            headers=auth_headers(token),
            timeout=10,
        )
    except Exception as e:
        fail(f"Request failed: {e}")
        return False

    if resp.status_code != 200:
        fail(f"HTTP {resp.status_code}: {resp.text}")
        return False

    detail = resp.json()
    trail = detail.get("audit_trail", [])

    sub_header(f"Full Audit Trail for action {action_id}")
    for i, event in enumerate(trail, 1):
        print(f"    {i}. [{event['event_type']}]")
        print(f"       Detail: {event.get('event_detail', 'N/A')}")
        print(f"       Time:   {event['timestamp']}")
        print(f"       User:   {event['user_id']}")
        print()

    # Verify all 4 expected events (for a completed restart)
    expected = [
        "ACTION_REQUESTED",
        "ACTION_APPROVED",
        "ACTION_EXECUTING",
        "ACTION_COMPLETED",
    ]

    event_types = [e["event_type"] for e in trail]

    all_present = True
    for exp in expected:
        if exp in event_types:
            ok(f"{exp} ✓")
        else:
            fail(f"{exp} — MISSING")
            all_present = False

    if all_present:
        ok(f"All {len(expected)} audit events present and in order!")
    else:
        fail("Some audit events missing")

    return all_present


# ═══════════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    header("Phase 6 — Action Service Tests")
    info("Checking services...")

    # Verify action-service is reachable
    try:
        resp = requests.get(f"{ACTION_SERVICE}/", timeout=5)
        if resp.status_code == 200:
            ok(f"Action service is running: {resp.json()}")
        else:
            fail(f"Action service returned {resp.status_code}")
            sys.exit(1)
    except Exception as e:
        fail(f"Cannot reach action-service at {ACTION_SERVICE}: {e}")
        sys.exit(1)

    # Get JWT
    token = get_token()
    if token:
        ok("Got JWT token from auth-service")
    else:
        fail("Could not get JWT token — aborting")
        sys.exit(1)

    # ── Run tests ─────────────────────────────────────────────────────────
    results = {}

    results["health"] = test_health(token)

    results["fetch_logs"] = test_fetch_logs(token)

    restart_action_id = test_restart_with_approval(token)
    results["restart"] = restart_action_id is not None

    results["rejection"] = test_rejection(token)

    results["audit"] = test_audit_trail(token, restart_action_id)

    # ── Summary ───────────────────────────────────────────────────────────
    header("Test Summary")
    total = len(results)
    passed = sum(1 for v in results.values() if v)
    for name, result in results.items():
        status = f"{GREEN}PASS{RESET}" if result else f"{RED}FAIL{RESET}"
        print(f"  {status}  {name}")

    print(f"\n  {passed}/{total} tests passed")

    if passed == total:
        print(f"\n  {GREEN}{BOLD}🎉 Phase 6 — ALL TESTS PASSED!{RESET}")
    else:
        print(f"\n  {YELLOW}Some tests failed — check logs above{RESET}")


if __name__ == "__main__":
    main()
