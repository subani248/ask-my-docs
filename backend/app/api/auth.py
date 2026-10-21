"""Authentication API endpoints: register, login, logout, me, google."""

import json
import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.database import USERS, get_db
from app.models.user import UserModel
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest, UserResponse
from app.services.auth import (
    create_access_token,
    hash_password,
    verify_password,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


# ── Schemas ────────────────────────────────────────────────────

class GoogleAuthRequest(BaseModel):
    credential: str


class UpdateProfileRequest(BaseModel):
    full_name: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


# ── Helpers ────────────────────────────────────────────────────

async def _get_or_create_google_user(user_info: dict) -> UserModel:
    """Find or create a user from Google profile info."""
    db = get_db()
    email = user_info.get("email")
    full_name = user_info.get("name", email.split("@")[0])
    google_id = user_info.get("sub")

    if not email:
        raise HTTPException(status_code=400, detail="Google account has no email")

    existing = await db[USERS].find_one({"email": email})
    if existing:
        if not existing.get("google_id"):
            await db[USERS].update_one(
                {"_id": existing["_id"]}, {"$set": {"google_id": google_id}}
            )
        return UserModel(**existing)

    user = UserModel(
        full_name=full_name,
        email=email,
        password_hash="",
        google_id=google_id,
    )
    await db[USERS].insert_one(user.model_dump())
    logger.info("Google user created: %s", email)
    return user


def _set_auth_cookie(response: Response, token: str) -> None:
    """Set the authentication cookie."""
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=3600,
        path="/",
    )


# ── Routes ─────────────────────────────────────────────────────


@router.post("/google", response_model=AuthResponse)
async def google_auth(body: GoogleAuthRequest, response: Response):
    """Authenticate or register a user via Google ID token."""
    cfg = get_settings()

    if not cfg.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Sign-In not configured. Set GOOGLE_CLIENT_ID in .env",
        )

    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token

        idinfo = id_token.verify_oauth2_token(
            body.credential,
            google_requests.Request(),
            cfg.GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=300,
        )

        user_info = {
            "email": idinfo.get("email"),
            "name": idinfo.get("name"),
            "sub": idinfo.get("sub"),
        }
        logger.info("Google token verified for: %s", user_info.get("email"))

    except ValueError as e:
        logger.error("Google token invalid: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {e}",
        )
    except Exception as e:
        logger.error("Google token verification error: %s", type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Google verification failed: {type(e).__name__}",
        )

    user = await _get_or_create_google_user(user_info)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    token = create_access_token(user.id)
    _set_auth_cookie(response, token)

    logger.info("Google auth success: %s", user.email)
    return AuthResponse(
        user=UserResponse.model_validate(user),
        access_token=token,
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, response: Response):
    """Register a new user account."""
    db = get_db()

    existing = await db[USERS].find_one({"email": body.email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    user = UserModel(
        full_name=body.full_name,
        email=body.email,
        password_hash=hash_password(body.password),
    )
    await db[USERS].insert_one(user.model_dump())

    token = create_access_token(user.id)
    _set_auth_cookie(response, token)

    logger.info("User registered: %s", user.email)
    return AuthResponse(
        user=UserResponse.model_validate(user),
        access_token=token,
    )


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, response: Response):
    """Authenticate a user and return a session cookie."""
    db = get_db()

    user_doc = await db[USERS].find_one({"email": body.email})
    if user_doc is None or not verify_password(body.password, user_doc["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email or password is incorrect",
        )

    user = UserModel(**user_doc)
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    token = create_access_token(user.id)
    _set_auth_cookie(response, token)

    logger.info("User logged in: %s", user.email)
    return AuthResponse(
        user=UserResponse.model_validate(user),
        access_token=token,
    )


@router.post("/logout")
async def logout(response: Response):
    """Clear the authentication cookie."""
    response.delete_cookie(key="access_token", path="/")
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def me(user: UserModel = Depends(get_current_user)):
    """Return the currently authenticated user."""
    return UserResponse.model_validate(user)


@router.put("/me", response_model=UserResponse)
async def update_me(
    body: UpdateProfileRequest,
    user: UserModel = Depends(get_current_user),
):
    """Update the authenticated user's profile."""
    db = get_db()

    await db[USERS].update_one(
        {"id": user.id},
        {"$set": {"full_name": body.full_name, "updated_at": user.updated_at}},
    )

    user.full_name = body.full_name
    return UserResponse.model_validate(user)


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    user: UserModel = Depends(get_current_user),
):
    """Change the authenticated user's password."""
    db = get_db()

    user_doc = await db[USERS].find_one({"id": user.id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    # Google-only users don't have a password
    if not user_doc.get("password_hash"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account uses Google Sign-In. Password not applicable.",
        )

    if not verify_password(body.current_password, user_doc["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
        )

    new_hash = hash_password(body.new_password)
    await db[USERS].update_one(
        {"id": user.id},
        {"$set": {"password_hash": new_hash}},
    )

    logger.info("Password changed for: %s", user.email)
    return {"message": "Password changed successfully"}


@router.get("/export")
async def export_data(user: UserModel = Depends(get_current_user)):
    """Export all user data as a JSON download."""
    db = get_db()

    # Gather user data
    documents = await db["documents"].find(
        {"owner_id": user.id}, {"_id": 0}
    ).to_list(length=1000)

    chunks = await db["chunks"].find(
        {"owner_id": user.id}, {"_id": 0}
    ).to_list(length=5000)

    ingestion_jobs = await db["ingestion_jobs"].find(
        {"owner_id": user.id}, {"_id": 0}
    ).to_list(length=1000)

    lines = []
    lines.append("=" * 60)
    lines.append("  ASK MY DOCS — DATA EXPORT")
    lines.append("=" * 60)
    lines.append("")
    lines.append(f"Exported: {datetime.now(UTC).strftime('%Y-%m-%d %H:%M:%S UTC')}")
    lines.append("")

    # User info
    lines.append("-" * 40)
    lines.append("  USER PROFILE")
    lines.append("-" * 40)
    lines.append(f"  Name:      {user.full_name}")
    lines.append(f"  Email:     {user.email}")
    lines.append(f"  Role:      {user.role}")
    lines.append(f"  Joined:    {user.created_at.strftime('%Y-%m-%d') if user.created_at else 'N/A'}")
    lines.append(f"  User ID:   {user.id}")
    lines.append("")

    # Documents with content
    lines.append("-" * 40)
    lines.append(f"  DOCUMENTS ({len(documents)} total)")
    lines.append("-" * 40)
    if documents:
        for i, doc in enumerate(documents, 1):
            doc_id = doc.get("id", "")
            lines.append("")
            lines.append(f"  [{i}] {doc.get('filename', 'Unknown')}")
            lines.append(f"      Type:     {doc.get('content_type', 'N/A')}")
            lines.append(f"      Size:     {doc.get('file_size', 0)} bytes")
            lines.append(f"      Status:   {doc.get('status', 'N/A')}")
            lines.append(f"      Uploaded: {doc.get('created_at', 'N/A')}")
            # Find chunks for this document
            doc_chunks = [c for c in chunks if c.get("document_id") == doc_id]
            if doc_chunks:
                doc_chunks.sort(key=lambda c: c.get("chunk_index", 0))
                lines.append(f"      Chunks:   {len(doc_chunks)}")
                lines.append("")
                for chunk in doc_chunks:
                    content = chunk.get("content", "")
                    page = chunk.get("page_number", "?")
                    section = chunk.get("section", "")
                    label = f"Page {page}" + (f" — {section}" if section else "")
                    lines.append(f"      [{label}]")
                    # Wrap content lines
                    for cline in content.split("\n"):
                        lines.append(f"        {cline}")
                    lines.append("")
            else:
                lines.append("      (No extracted text available)")
    else:
        lines.append("  No documents uploaded yet.")
    lines.append("")

    # Stats
    lines.append("-" * 40)
    lines.append("  STATISTICS")
    lines.append("-" * 40)
    lines.append(f"  Total documents:    {len(documents)}")
    lines.append(f"  Total chunks:       {len(chunks)}")
    lines.append(f"  Ingestion jobs:     {len(ingestion_jobs)}")
    lines.append("")
    lines.append("=" * 60)
    lines.append("  End of export")
    lines.append("=" * 60)

    content = "\n".join(lines)
    filename = f"askmydocs-export-{user.id[:8]}.txt"

    return StreamingResponse(
        iter([content]),
        media_type="text/plain",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.delete("/me")
async def delete_account(
    response: Response,
    user: UserModel = Depends(get_current_user),
):
    """Delete the authenticated user and all associated data."""
    db = get_db()

    # Delete all user data
    documents = await db["documents"].find(
        {"owner_id": user.id}
    ).to_list(length=10000)
    doc_ids = [d.get("id") for d in documents if d.get("id")]

    # Delete chunks for all user documents
    if doc_ids:
        await db["chunks"].delete_many({"document_id": {"$in": doc_ids}})

    # Delete ingestion jobs
    await db["ingestion_jobs"].delete_many({"owner_id": user.id})

    # Delete documents
    await db["documents"].delete_many({"owner_id": user.id})

    # Delete user
    await db[USERS].delete_one({"id": user.id})

    # Clear cookie
    response.delete_cookie(key="access_token", path="/")

    logger.info("Account deleted: %s (had %d documents)", user.email, len(documents))
    return {"message": "Account deleted successfully"}
