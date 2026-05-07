from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from backend.app.schemas.common import ORMBaseModel


class ClubBase(BaseModel):
    club: str
    carry_yards: float = Field(..., gt=0)
    total_yards: float = Field(..., gt=0)
    lateral_sigma: float = Field(..., ge=0)
    distance_sigma: float = Field(..., ge=0)
    confidence: float = Field(..., ge=0, le=1)
    shape_bias: float = 0.0
    lie_adjustment_sensitivity: float = Field(0.08, ge=0)

    @model_validator(mode="after")
    def validate_distance_order(self) -> "ClubBase":
        if self.total_yards < self.carry_yards:
            raise ValueError("total_yards cannot be less than carry_yards.")
        return self


class ClubCreate(ClubBase):
    pass


class ClubRead(ORMBaseModel, ClubBase):
    id: int


class PlayerBase(BaseModel):
    player_name: str
    handicap: float
    handedness: Literal["right", "left"] = "right"
    preferred_shape: Literal["straight", "draw", "fade"]
    miss_tendency: Literal["center", "none", "left", "right", "pull", "push"]
    risk_tolerance: Literal["low", "medium", "high"]


class PlayerCreate(PlayerBase):
    clubs: list[ClubCreate]


class PlayerSummary(ORMBaseModel, PlayerBase):
    id: int
    club_count: int


class PlayerDetail(ORMBaseModel, PlayerBase):
    id: int
    clubs: list[ClubRead]
