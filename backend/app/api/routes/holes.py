from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database.database import get_db
from backend.app.schemas.hole import HoleCreate, HoleDetail, HoleSummary
from backend.app.services.hole_service import (
    create_hole,
    delete_hole,
    get_hole_by_external_id,
    list_holes,
    to_detail_schema,
    update_hole,
)


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
def get_hole(hole_id: str, db: Session = Depends(get_db)) -> HoleDetail:
    hole = get_hole_by_external_id(db, hole_id)
    return to_detail_schema(hole)


@router.post("/holes", response_model=HoleDetail, status_code=status.HTTP_201_CREATED)
def post_hole(payload: HoleCreate, db: Session = Depends(get_db)) -> HoleDetail:
    try:
        hole = create_hole(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return to_detail_schema(hole)


@router.put("/holes/{hole_id}", response_model=HoleDetail)
def put_hole(hole_id: str, payload: HoleCreate, db: Session = Depends(get_db)) -> HoleDetail:
    try:
        hole = update_hole(db, hole_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return to_detail_schema(hole)


@router.delete("/holes/{hole_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_hole(hole_id: str, db: Session = Depends(get_db)) -> None:
    delete_hole(db, hole_id)
