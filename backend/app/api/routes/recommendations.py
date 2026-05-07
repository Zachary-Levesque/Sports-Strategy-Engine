from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.database.database import get_db
from backend.app.schemas.recommendation import (
    RecommendationRequest,
    RecommendationResponse,
    SimulationResponse,
)
from backend.app.services.recommendation_service import compute_recommendation, simulate


router = APIRouter(tags=["simulation"])


@router.post("/recommendation", response_model=RecommendationResponse)
def post_recommendation(
    payload: RecommendationRequest,
    db: Session = Depends(get_db),
) -> RecommendationResponse:
    return compute_recommendation(db, payload)


@router.post("/simulate", response_model=SimulationResponse)
def post_simulate(
    payload: RecommendationRequest,
    db: Session = Depends(get_db),
) -> SimulationResponse:
    return simulate(db, payload)
