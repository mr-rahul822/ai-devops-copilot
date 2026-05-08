"""
test_phase4.py — End-to-end test for Phase 4 AI Engine.

Test 1: Diagnose
  - Calls POST /ai/diagnose with simulated data
  - Prints the full AI response
  - Verifies the incident was saved to DB via GET /ai/incidents/:id
  - Verifies the incident is queryable

Test 2: RAG Learning Loop
  - Resolves the incident from Test 1 with a resolution text
    (this embeds it into Pinecone)
  - Waits a moment for Pinecone indexing
  - Creates a SECOND similar incident
  - Shows the AI now references the past incident (proves RAG works)

Usage:
  1. Set your token:   TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwiaWF0IjoxNzc2NDk3NDU1LCJleHAiOjE3NzcxMDIyNTV9.bt9VcvciFN9MYxL_9S8FstJV53H4ZzY_X7fxzW-DgN0"
  2. Run:              python test_phase4.py
"""

import json
import sys
import time
import requests

# ═══════════════════════════════════════════════════════════════════════════
# CONFIGURATION — EDIT THESE
# ═══════════════════════════════════════════════════════════════════════════

BASE_URL = "http://localhost:8002"
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwiaWF0IjoxNzc2NDk3NDU1LCJleHAiOjE3NzcxMDIyNTV9.bt9VcvciFN9MYxL_9S8FstJV53H4ZzY_X7fxzW-DgN0"
USER_ID = "00000000-0000-0000-0000-000000000001"

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}


def separator(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")


# ═══════════════════════════════════════════════════════════════════════════
# TEST 1 — DIAGNOSE
# ═══════════════════════════════════════════════════════════════════════════

def test_diagnose():
    separator("TEST 1: POST /ai/diagnose")

    payload = {
        "user_id": USER_ID,
        "service_name": "api-server",
        "alert_type": "CPU_SPIKE",
        "log_excerpt": "Error: connection pool exhausted at DatabasePool.acquire (pool.js:142). Active connections: 50/50. Waiting queue: 23 requests."
    }

    print("Sending diagnosis request...")
    print(f"Payload: {json.dumps(payload, indent=2)}\n")

    resp = requests.post(f"{BASE_URL}/ai/diagnose", json=payload, headers=HEADERS)

    if resp.status_code != 200:
        print(f"ERROR: Got status {resp.status_code}")
        print(resp.text)
        sys.exit(1)

    data = resp.json()
    print("AI Diagnosis Response:")
    print(json.dumps(data, indent=2))

    incident_id = data.get("incident_id")
    print(f"\nIncident ID: {incident_id}")

    # Verify incident saved to DB
    separator("VERIFY: GET /ai/incidents/{id}")
    resp2 = requests.get(f"{BASE_URL}/ai/incidents/{incident_id}", headers=HEADERS)

    if resp2.status_code == 200:
        print("Incident found in database.")
        print(f"Status: {resp2.json().get('status')}")
        print(f"Root cause: {resp2.json().get('root_cause')}")
    else:
        print(f"ERROR: Incident not found. Status: {resp2.status_code}")

    return incident_id


# ═══════════════════════════════════════════════════════════════════════════
# TEST 2 — RAG LEARNING LOOP
# ═══════════════════════════════════════════════════════════════════════════

def test_rag(incident_id):
    separator("TEST 2: RAG Learning Loop")

    # Step A: Resolve the first incident
    print("Step A: Resolving incident with resolution text...")
    resolve_payload = {
        "resolution": "Restarted the api-server pod and increased connection pool max from 50 to 100 in config/database.yml. Root cause was a memory leak in v2.1.3 causing connections to hang. Rolled back to v2.1.2."
    }

    resp = requests.post(
        f"{BASE_URL}/ai/incidents/{incident_id}/resolve",
        json=resolve_payload,
        headers=HEADERS,
    )

    if resp.status_code == 200:
        print(f"Incident resolved successfully. Status: {resp.json().get('status')}")
        print(f"Resolution: {resp.json().get('resolution')}")
    else:
        print(f"ERROR resolving: {resp.status_code} — {resp.text}")
        return

    # Wait for Pinecone indexing (serverless can take a few seconds)
    print("\nWaiting 10 seconds for Pinecone to index the vector...")
    time.sleep(10)

    # Step B: Create a SIMILAR incident
    separator("Step B: Creating a similar incident (should reference past resolution)")

    payload2 = {
        "user_id": USER_ID,
        "service_name": "api-server",
        "alert_type": "CPU_SPIKE",
        "log_excerpt": "Error: connection pool exhausted at DatabasePool.acquire. Active connections: 48/50. Queue depth: 15."
    }

    resp2 = requests.post(f"{BASE_URL}/ai/diagnose", json=payload2, headers=HEADERS)

    if resp2.status_code == 200:
        data = resp2.json()
        print("Second AI Diagnosis Response:")
        print(json.dumps(data, indent=2))
        print("\n--- RAG CHECK ---")
        similar = data.get("similar_past_incident")
        if similar:
            print(f"AI referenced a past incident: {similar}")
            print("RAG IS WORKING!")
        else:
            print("AI did not reference a past incident.")
            print("(This is OK on first run — Pinecone may need more time to index)")
    else:
        print(f"ERROR: {resp2.status_code} — {resp2.text}")


# ═══════════════════════════════════════════════════════════════════════════
# TEST 3 — CHAT
# ═══════════════════════════════════════════════════════════════════════════

def test_chat():
    separator("TEST 3: POST /ai/chat")

    payload = {
        "user_id": USER_ID,
        "message": "Why was my api-server having issues? What should I monitor?",
        "service_name": "api-server",
        "conversation_history": []
    }

    resp = requests.post(f"{BASE_URL}/ai/chat", json=payload, headers=HEADERS)

    if resp.status_code == 200:
        data = resp.json()
        print(f"AI Reply:\n{data.get('reply')}")
        print(f"\nContext used: {data.get('context_used')}")
    else:
        print(f"ERROR: {resp.status_code} — {resp.text}")


# ═══════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    # Health check first
    separator("HEALTH CHECK")
    try:
        resp = requests.get(f"{BASE_URL}/ai/health")
        print(json.dumps(resp.json(), indent=2))
    except requests.ConnectionError:
        print("ERROR: Cannot connect to AI Engine at", BASE_URL)
        print("Make sure the service is running: docker-compose up --build")
        sys.exit(1)

    incident_id = test_diagnose()
    test_rag(incident_id)
    test_chat()

    separator("ALL TESTS COMPLETE")
    print("Check your Pinecone dashboard at https://app.pinecone.io")
    print("to verify the vector was stored.\n")

    print("SQL queries to verify DB state:")
    print('  docker exec -it postgres psql -U authuser -d authdb -c "SELECT id, service_name, alert_type, severity, status, root_cause FROM incidents;"')
    print('  docker exec -it postgres psql -U authuser -d authdb -c "SELECT id, resolution, resolved_at FROM incidents WHERE status = \'resolved\';"')
