from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.core.exceptions import NotFoundError
from backend.app.models.orm import HoleORM
from backend.app.schemas.hole import HoleDetail, PointSchema, WindSchema, ZoneSchema
from backend.app.simulation.hole_generator import Hole, Point, Wind, Zone
from backend.app.utils.serialization import loads


def list_holes(db: Session) -> list[HoleORM]:
    return list(db.scalars(select(HoleORM).order_by(HoleORM.name)))


def get_hole_by_id(db: Session, hole_id: int) -> HoleORM:
    hole = db.scalar(select(HoleORM).where(HoleORM.id == hole_id))
    if hole is None:
        raise NotFoundError(f"Hole {hole_id} was not found.")
    return hole


def get_hole_by_external_id(db: Session, external_hole_id: str) -> HoleORM:
    hole = db.scalar(select(HoleORM).where(HoleORM.external_hole_id == external_hole_id))
    if hole is None:
        raise NotFoundError(f"Hole '{external_hole_id}' was not found.")
    return hole


def to_domain(hole: HoleORM) -> Hole:
    hazards = [Zone(**item) for item in loads(hole.hazards_json)]
    return Hole(
        hole_id=hole.external_hole_id,
        name=hole.name,
        par=hole.par,
        yardage=hole.yardage,
        tee=Point(x=hole.tee_x, y=hole.tee_y),
        green_center=Point(x=hole.green_center_x, y=hole.green_center_y),
        green_radius=hole.green_radius,
        fairway_center_x=hole.fairway_center_x,
        fairway_width=hole.fairway_width,
        fairway_start_y=hole.fairway_start_y,
        fairway_end_y=hole.fairway_end_y,
        rough_width=hole.rough_width,
        hazards=hazards,
        wind=Wind(speed_mph=hole.wind_speed_mph, direction_deg=hole.wind_direction_deg),
    )


def to_detail_schema(hole: HoleORM) -> HoleDetail:
    hazards = [ZoneSchema(**item) for item in loads(hole.hazards_json)]
    return HoleDetail(
        id=hole.id,
        hole_id=hole.external_hole_id,
        name=hole.name,
        par=hole.par,
        yardage=hole.yardage,
        tee=PointSchema(x=hole.tee_x, y=hole.tee_y),
        green_center=PointSchema(x=hole.green_center_x, y=hole.green_center_y),
        green_radius=hole.green_radius,
        fairway_center_x=hole.fairway_center_x,
        fairway_width=hole.fairway_width,
        fairway_start_y=hole.fairway_start_y,
        fairway_end_y=hole.fairway_end_y,
        rough_width=hole.rough_width,
        hazards=hazards,
        wind=WindSchema(speed_mph=hole.wind_speed_mph, direction_deg=hole.wind_direction_deg),
    )
