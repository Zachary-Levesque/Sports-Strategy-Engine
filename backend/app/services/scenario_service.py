from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.models.orm import ScenarioORM
from backend.app.schemas.scenario import ScenarioSummary


def load_scenarios(db: Session) -> list[ScenarioSummary]:
    rows = list(db.scalars(select(ScenarioORM).order_by(ScenarioORM.name)))
    return [
        ScenarioSummary(
            id=row.id,
            name=row.name,
            player_name=row.player_name,
            hole_id=row.hole_id,
            iterations=row.iterations,
            risk_tolerance_override=row.risk_tolerance_override,
        )
        for row in rows
    ]
