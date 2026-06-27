import logging
import uuid
import jwt
from typing import Optional
from fastapi import Header, HTTPException, Depends
from src.config import settings

logger = logging.getLogger(__name__)

async def verify_token(authorization: Optional[str] = Header(default=None)) -> str:
    """
    FastAPI dependency that decodes and verifies the JWT signature.
    Enforces algorithm type (HS256) and validity.
    
    Returns:
        The authenticated user ID string.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or malformed Authorization header."
        )
    
    token = authorization.split(" ", 1)[1]
    
    try:
        decoded = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
        
    user_id = decoded.get("userId") or decoded.get("user_id") or decoded.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload.")
        
    try:
        # Validate that the user ID is a valid UUID
        uuid.UUID(str(user_id))
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid user ID format in token.")
        
    return str(user_id)
