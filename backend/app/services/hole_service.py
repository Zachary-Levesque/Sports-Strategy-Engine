from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.core.exceptions import NotFoundError
from backend.app.models.orm import HoleORM, ScenarioORM
from backend.app.schemas.hole import HoleCreate, HoleDetail, PointSchema, WindSchema, ZoneSchema
from backend.app.simulation.hole_generator import Hole, Point, Wind, Zone
from backend.app.utils.serialization import dumps, loads


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


def create_hole(db: Session, payload: HoleCreate) -> HoleORM:
    existing = db.scalar(select(HoleORM).where(HoleORM.external_hole_id == payload.hole_id))
    if existing is not None:
        raise ValueError(f"Hole '{payload.hole_id}' already exists.")
    hole = HoleORM(
        external_hole_id=payload.hole_id,
        name=payload.name,
        par=payload.par,
        yardage=payload.yardage,
        tee_x=payload.tee.x,
        tee_y=payload.tee.y,
        green_center_x=payload.green_center.x,
        green_center_y=payload.green_center.y,
        green_radius=payload.green_radius,
        pin_x=payload.pin_position.x if payload.pin_position else None,
        pin_y=payload.pin_position.y if payload.pin_position else None,
        fairway_center_x=payload.fairway_center_x,
        fairway_width=payload.fairway_width,
        fairway_start_y=payload.fairway_start_y,
        fairway_end_y=payload.fairway_end_y,
        rough_width=payload.rough_width,
        fairway_path_json=dumps([point.model_dump() for point in payload.fairway_path]) if payload.fairway_path else None,
        hazards_json=dumps([hazard.model_dump() for hazard in payload.hazards]),
        wind_speed_mph=payload.wind.speed_mph,
        wind_direction_deg=payload.wind.direction_deg,
    )
    db.add(hole)
    db.commit()
    db.refresh(hole)
    return hole


def update_hole(db: Session, hole_id: str, payload: HoleCreate) -> HoleORM:
    hole = get_hole_by_external_id(db, hole_id)
    old_hole_id = hole.external_hole_id
    if payload.hole_id != hole_id:
        existing = db.scalar(select(HoleORM).where(HoleORM.external_hole_id == payload.hole_id))
        if existing is not None:
            raise ValueError(f"Hole '{payload.hole_id}' already exists.")
    hole.external_hole_id = payload.hole_id
    hole.name = payload.name
    hole.par = payload.par
    hole.yardage = payload.yardage
    hole.tee_x = payload.tee.x
    hole.tee_y = payload.tee.y
    hole.green_center_x = payload.green_center.x
    hole.green_center_y = payload.green_center.y
    hole.green_radius = payload.green_radius
    hole.pin_x = payload.pin_position.x if payload.pin_position else None
    hole.pin_y = payload.pin_position.y if payload.pin_position else None
    hole.fairway_center_x = payload.fairway_center_x
    hole.fairway_width = payload.fairway_width
    hole.fairway_start_y = payload.fairway_start_y
    hole.fairway_end_y = payload.fairway_end_y
    hole.rough_width = payload.rough_width
    hole.fairway_path_json = (
        dumps([point.model_dump() for point in payload.fairway_path]) if payload.fairway_path else None
    )
    hole.hazards_json = dumps([hazard.model_dump() for hazard in payload.hazards])
    hole.wind_speed_mph = payload.wind.speed_mph
    hole.wind_direction_deg = payload.wind.direction_deg
    if payload.hole_id != old_hole_id:
        scenarios = list(db.scalars(select(ScenarioORM).where(ScenarioORM.hole_id == old_hole_id)))
        for scenario in scenarios:
            scenario.hole_id = payload.hole_id
    db.commit()
    db.refresh(hole)
    return hole


def delete_hole(db: Session, hole_id: str) -> None:
    hole = get_hole_by_external_id(db, hole_id)
    scenarios = list(db.scalars(select(ScenarioORM).where(ScenarioORM.hole_id == hole_id)))
    for scenario in scenarios:
        db.delete(scenario)
    db.delete(hole)
    db.commit()


def to_domain(hole: HoleORM) -> Hole:
    hazards = [Zone(**item) for item in loads(hole.hazards_json)]
    fairway_path = loads(hole.fairway_path_json) if hole.fairway_path_json else None
    pin_position = Point(x=hole.pin_x, y=hole.pin_y) if hole.pin_x is not None and hole.pin_y is not None else None
    return Hole(
        hole_id=hole.external_hole_id,
        name=hole.name,
        par=hole.par,
        yardage=hole.yardage,
        tee=Point(x=hole.tee_x, y=hole.tee_y),
        green_center=Point(x=hole.green_center_x, y=hole.green_center_y),
        green_radius=hole.green_radius,
        pin_position=pin_position or Point(x=hole.green_center_x, y=hole.green_center_y),
        fairway_center_x=hole.fairway_center_x,
        fairway_width=hole.fairway_width,
        fairway_start_y=hole.fairway_start_y,
        fairway_end_y=hole.fairway_end_y,
        rough_width=hole.rough_width,
        fairway_path=[Point(**point) for point in fairway_path] if fairway_path else None,
        hazards=hazards,
        wind=Wind(speed_mph=hole.wind_speed_mph, direction_deg=hole.wind_direction_deg),
    )


def to_detail_schema(hole: HoleORM) -> HoleDetail:
    hazards = [ZoneSchema(**item) for item in loads(hole.hazards_json)]
    fairway_path = loads(hole.fairway_path_json) if hole.fairway_path_json else None
    pin_position = (
        PointSchema(x=hole.pin_x, y=hole.pin_y)
        if hole.pin_x is not None and hole.pin_y is not None
        else PointSchema(x=hole.green_center_x, y=hole.green_center_y)
    )
    return HoleDetail(
        id=hole.id,
        hole_id=hole.external_hole_id,
        name=hole.name,
        par=hole.par,
        yardage=hole.yardage,
        tee=PointSchema(x=hole.tee_x, y=hole.tee_y),
        green_center=PointSchema(x=hole.green_center_x, y=hole.green_center_y),
        green_radius=hole.green_radius,
        pin_position=pin_position,
        fairway_center_x=hole.fairway_center_x,
        fairway_width=hole.fairway_width,
        fairway_start_y=hole.fairway_start_y,
        fairway_end_y=hole.fairway_end_y,
        rough_width=hole.rough_width,
        fairway_path=[PointSchema(**point) for point in fairway_path] if fairway_path else None,
        hazards=hazards,
        wind=WindSchema(speed_mph=hole.wind_speed_mph, direction_deg=hole.wind_direction_deg),
    )
