"""Authentication request/response schemas."""

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    """Schema for user registration."""

    full_name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class LoginRequest(BaseModel):
    """Schema for user login."""

    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """Schema for user data in API responses."""

    id: str
    full_name: str
    email: str
    role: str
    is_active: bool
    google_id: str | None = None

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    """Schema for authentication responses (login/register)."""

    user: UserResponse
    access_token: str
    token_type: str = "bearer"
