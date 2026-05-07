from __future__ import annotations

from sqlalchemy.orm import Session

from backend.app.database.database import get_db


def get_db_session() -> Session:
    return next(get_db())
