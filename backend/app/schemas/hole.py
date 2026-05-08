from __future__ import annotations

from pydantic import BaseModel, Field, model_validator

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

    @model_validator(mode="after")
    def validate_zone(self) -> "ZoneSchema":
        if self.shape == "circle" and self.radius is None:
            raise ValueError("circle hazards require radius")
        if self.shape == "rectangle" and self.width is None and self.x_min is None:
            raise ValueError("rectangle hazards require width/depth or explicit min/max bounds")
        return self


class HoleBase(BaseModel):
    hole_id: str
    name: str
    par: int = Field(..., ge=3, le=5)
    yardage: float = Field(..., gt=0)
    tee: PointSchema
    green_center: PointSchema
    green_radius: float = Field(..., gt=0)
    pin_position: PointSchema | None = None
    fairway_center_x: float
    fairway_width: float = Field(..., gt=0)
    fairway_start_y: float = Field(..., ge=0)
    fairway_end_y: float = Field(..., ge=0)
    rough_width: float = Field(..., ge=0)
    fairway_path: list[PointSchema] | None = None
    hazards: list[ZoneSchema]
    wind: WindSchema

    @model_validator(mode="after")
    def validate_hole_geometry(self) -> "HoleBase":
        if self.fairway_end_y <= self.fairway_start_y:
            raise ValueError("fairway_end_y must be greater than fairway_start_y")
        return self


class HoleCreate(HoleBase):
    pass


class HoleUpdate(HoleBase):
    pass


class HoleSummary(ORMBaseModel):
    id: int
    hole_id: str
    name: str
    par: int
    yardage: float
    wind_speed_mph: float
    wind_direction_deg: float


class HoleDetail(HoleBase):
    id: int
