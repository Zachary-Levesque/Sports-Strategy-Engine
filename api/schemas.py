from __future__ import annotations

from pydantic import BaseModel, Field


class RecommendationRequest(BaseModel):
    player_name: str = Field(..., description="Name of the player profile to simulate")
    hole_id: str = Field(..., description="Identifier of the hole to simulate")
    iterations: int = Field(3000, ge=100, le=50000, description="Monte Carlo sample count")
    risk_tolerance_override: str | None = Field(
        default=None,
        description="Optional override: low, medium, or high",
    )


class StrategySummary(BaseModel):
    club: str
    aim_label: str
    aim_point: dict[str, float]
    shot_shape: str
    swing_intensity: float
    expected_strokes: float
    risk_adjusted_score: float
    penalty_probability: float
    fairway_probability: float
    rough_probability: float
    green_probability: float
    bunker_probability: float
    water_probability: float
    ob_probability: float
    variance: float


class RecommendationResponse(BaseModel):
    player_name: str
    hole_id: str
    recommendation: StrategySummary
    explanation: str
    top_alternatives: list[StrategySummary]


class HealthResponse(BaseModel):
    status: str


class PlayerListItem(BaseModel):
    player_name: str
    handicap: float
    handedness: str
    preferred_shape: str
    miss_tendency: str
    risk_tolerance: str
    club_count: int


class HoleListItem(BaseModel):
    hole_id: str
    name: str
    par: int
    yardage: float
    wind_speed_mph: float
    wind_direction_deg: float


class ScenarioListItem(BaseModel):
    name: str
    player_name: str
    hole_id: str
    iterations: int
    risk_tolerance_override: str | None = None
