from __future__ import annotations

from pydantic import BaseModel, Field

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


class ClubCreate(ClubBase):
    pass


class ClubRead(ORMBaseModel, ClubBase):
    id: int


class PlayerBase(BaseModel):
    player_name: str
    handicap: float
    handedness: str = "right"
    preferred_shape: str
    miss_tendency: str
    risk_tolerance: str


class PlayerCreate(PlayerBase):
    clubs: list[ClubCreate]


class PlayerSummary(ORMBaseModel, PlayerBase):
    id: int
    club_count: int


class PlayerDetail(ORMBaseModel, PlayerBase):
    id: int
    clubs: list[ClubRead]
