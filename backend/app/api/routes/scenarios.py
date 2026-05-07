from __future__ import annotations

from fastapi import APIRouter

from backend.app.schemas.scenario import ScenarioSummary
from backend.app.services.scenario_service import load_scenarios


router = APIRouter(tags=["scenarios"])


@router.get("/scenarios", response_model=list[ScenarioSummary])
def get_scenarios() -> list[ScenarioSummary]:
    return load_scenarios()
