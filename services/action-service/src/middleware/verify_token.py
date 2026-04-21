"""
src/middleware/verify_token.py — JWT verification via the auth-service.

Calls GET http://auth-service:3001/auth/me with the Bearer token.
  - If auth-service responds 200 → user is authenticated, return user dict.
  - If auth-service is DOWN     → return 503 (not 401) so the caller
    knows it's a transient infra issue, not bad credentials.
  - If token is invalid          → return 401.
"""

import logging
import os

import httpx
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

logger = logging.getLogger(__name__)

AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://auth-service:3001")

_bearer_scheme = HTTPBearer(auto_error=False)


async def verify_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> dict:
    """
    FastAPI dependency that verifies the JWT by calling the auth-service.

    Returns:
        The authenticated user dict from auth-service.

    Raises:
        HTTPException 401 — bad or missing token.
        HTTPException 503 — auth-service unreachable.
    """
    if credentials is None:
        raise HTTPException(status_code=401, detail="Access denied. No token provided.")

    token = credentials.credentials

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{AUTH_SERVICE_URL}/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )
    except (httpx.ConnectError, httpx.TimeoutException) as e:
        logger.error("Auth-service unreachable: %s", e)
        raise HTTPException(
            status_code=503,
            detail="Auth service is unavailable. Please try again later.",
        )

    if resp.status_code == 200:
        data = resp.json()
        # auth-service returns { user: { id, email, ... } }
        return data.get("user", data)

    if resp.status_code == 401:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    # Unexpected status from auth-service
    logger.warning("Auth-service returned %d: %s", resp.status_code, resp.text)
    raise HTTPException(
        status_code=503,
        detail=f"Auth service returned unexpected status {resp.status_code}.",
    )
