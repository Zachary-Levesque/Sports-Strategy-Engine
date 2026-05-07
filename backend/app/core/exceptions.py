from __future__ import annotations


class AppError(Exception):
    """Base application error."""


class NotFoundError(AppError):
    """Raised when an entity cannot be found."""


class SimulationError(AppError):
    """Raised when simulation execution fails."""
