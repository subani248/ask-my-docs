"""User model for MongoDB."""

import uuid
from datetime import UTC, datetime

from pydantic import BaseModel, Field


class UserModel(BaseModel):
    """User document stored in MongoDB."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    full_name: str
    email: str
    password_hash: str = ""
    google_id: str | None = None
    role: str = "user"
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    model_config = {"from_attributes": True}
