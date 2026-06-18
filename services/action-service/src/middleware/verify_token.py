"""
src/middleware/verify_token.py — JWT verification via local decoding.
"""

import logging
import os
import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

logger = logging.getLogger(__name__)

JWT_SECRET = os.getenv("JWT_SECRET", "14856ac8af742b72db85a5c25170f0a0e2137c8a19a8e6081f8e5d9097cb92b5")

_bearer_scheme = HTTPBearer(auto_error=False)


async def verify_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> dict:
    """
    FastAPI dependency that verifies the JWT locally to avoid rate limiter cascade.

    Returns:
        The authenticated user dict.
    """
    if credentials is None:
        raise HTTPException(status_code=401, detail="Access denied. No token provided.")

    token = credentials.credentials

    try:
        decoded = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    user_id = decoded.get("userId")
    email = decoded.get("email")

    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload.")

    return {
        "id": user_id,
        "email": email
    }

