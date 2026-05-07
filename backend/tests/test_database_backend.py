from __future__ import annotations

from sqlalchemy import select

from backend.app.database.database import SessionLocal
from backend.app.models.orm import HoleORM, PlayerORM


def test_seed_data_is_loaded_into_database():
    with SessionLocal() as db:
        players = list(db.scalars(select(PlayerORM)))
        holes = list(db.scalars(select(HoleORM)))
    assert len(players) >= 2
    assert len(holes) >= 3
