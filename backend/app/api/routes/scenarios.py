from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.database.database import get_db
from backend.app.schemas.scenario import ScenarioSummary
from backend.app.services.scenario_service import load_scenarios


router = APIRouter(tags=["scenarios"])


@router.get("/scenarios", response_model=list[ScenarioSummary])
def get_scenarios(db: Session = Depends(get_db)) -> list[ScenarioSummary]:
    return load_scenarios(db)
