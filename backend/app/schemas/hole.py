from __future__ import annotations

from pydantic import BaseModel

from backend.app.schemas.common import ORMBaseModel


class PointSchema(BaseModel):
    x: float
    y: float


class WindSchema(BaseModel):
    speed_mph: float
    direction_deg: float


class ZoneSchema(BaseModel):
    kind: str
    shape: str
    center_x: float
    center_y: float
    radius: float | None = None
    width: float | None = None
    depth: float | None = None
    start_y: float | None = None
    end_y: float | None = None
    x_min: float | None = None
    x_max: float | None = None
    y_min: float | None = None
    y_max: float | None = None
    penalty_strokes: float = 0.0


class HoleSummary(ORMBaseModel):
    id: int
    hole_id: str
    name: str
    par: int
    yardage: float
    wind_speed_mph: float
    wind_direction_deg: float


class HoleDetail(BaseModel):
    id: int
    hole_id: str
    name: str
    par: int
    yardage: float
    tee: PointSchema
    green_center: PointSchema
    green_radius: float
    fairway_center_x: float
    fairway_width: float
    fairway_start_y: float
    fairway_end_y: float
    rough_width: float
    hazards: list[ZoneSchema]
    wind: WindSchema
