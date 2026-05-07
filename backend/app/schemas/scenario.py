from __future__ import annotations

from pydantic import BaseModel


class ScenarioSummary(BaseModel):
    name: str
    player_name: str
    hole_id: str
    iterations: int
    risk_tolerance_override: str | None = None
