"""Centralized error handling for FastAPI."""

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class AppError(Exception):
    """Base application error."""

    def __init__(self, message: str, status_code: int = 500, detail: Any = None):
        self.message = message
        self.status_code = status_code
        self.detail = detail
        super().__init__(message)


class ServiceUnavailableError(AppError):
    """Raised when a required service is unavailable."""

    def __init__(self, service: str, detail: Any = None):
        super().__init__(
            message=f"Service unavailable: {service}",
            status_code=503,
            detail=detail,
        )


class NotFoundError(AppError):
    """Raised when a resource is not found."""

    def __init__(self, resource: str, resource_id: str = ""):
        msg = f"{resource} not found"
        if resource_id:
            msg = f"{resource} with id '{resource_id}' not found"
        super().__init__(message=msg, status_code=404)


class ValidationError(AppError):
    """Raised on input validation failure."""

    def __init__(self, message: str, detail: Any = None):
        super().__init__(message=message, status_code=422, detail=detail)


def _error_response(status_code: int, message: str, detail: Any = None) -> JSONResponse:
    body: dict[str, Any] = {"error": message}
    if detail is not None:
        body["detail"] = detail
    return JSONResponse(status_code=status_code, content=body)


def register_error_handlers(app: FastAPI) -> None:
    """Register global exception handlers on the FastAPI app."""

    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        logger.warning("AppError: %s", exc.message, exc_info=False)
        return _error_response(exc.status_code, exc.message, exc.detail)

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception")
        return _error_response(500, "Internal server error")
