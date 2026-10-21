"""FastAPI dependencies for authentication and authorization."""

import logging

from fastapi import Cookie, HTTPException, status

from app.db.database import USERS, get_db
from app.models.user import UserModel
from app.services.auth import decode_access_token

logger = logging.getLogger(__name__)


async def get_current_user(
    access_token: str | None = Cookie(None, alias="access_token"),
) -> UserModel:
    """Extract and validate the current user from the access_token cookie."""
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    user_id = decode_access_token(access_token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    db = get_db()
    user_doc = await db[USERS].find_one({"id": user_id})
    if user_doc is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    user = UserModel(**user_doc)
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    return user
