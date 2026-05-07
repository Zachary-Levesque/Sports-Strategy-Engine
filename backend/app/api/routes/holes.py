from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.database.database import get_db
from backend.app.schemas.hole import HoleDetail, HoleSummary
from backend.app.services.hole_service import get_hole_by_id, list_holes, to_detail_schema


router = APIRouter(tags=["holes"])


@router.get("/holes", response_model=list[HoleSummary])
def get_holes(db: Session = Depends(get_db)) -> list[HoleSummary]:
    holes = list_holes(db)
    return [
        HoleSummary(
            id=hole.id,
            hole_id=hole.external_hole_id,
            name=hole.name,
            par=hole.par,
            yardage=hole.yardage,
            wind_speed_mph=hole.wind_speed_mph,
            wind_direction_deg=hole.wind_direction_deg,
        )
        for hole in holes
    ]


@router.get("/holes/{hole_id}", response_model=HoleDetail)
def get_hole(hole_id: int, db: Session = Depends(get_db)) -> HoleDetail:
    hole = get_hole_by_id(db, hole_id)
    return to_detail_schema(hole)
