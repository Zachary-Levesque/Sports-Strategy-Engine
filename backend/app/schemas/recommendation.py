from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from backend.app.core.config import get_settings


class AimPointSchema(BaseModel):
    x: float
    y: float


class ProbabilitySummary(BaseModel):
    penalty_probability: float
    fairway_probability: float
    rough_probability: float
    green_probability: float
    bunker_probability: float
    water_probability: float
    ob_probability: float
    recovery_probability: float


class StrategySummary(BaseModel):
    club: str
    aim_label: str
    aim_point: AimPointSchema
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


class ShotCloudSummary(BaseModel):
    sample_count: int
    centroid: AimPointSchema
    x_range: list[float]
    y_range: list[float]


class RecommendationRequest(BaseModel):
    player_name: str
    hole_id: str
    iterations: int = Field(get_settings().default_iterations, ge=100, le=50000)
    risk_tolerance_override: Literal["low", "medium", "high"] | None = Field(default=None)


class RecommendationResponse(BaseModel):
    recommendation_id: int | None = None
    player_name: str
    hole_id: str
    best_strategy: StrategySummary
    top_alternatives: list[StrategySummary]
    probabilities: ProbabilitySummary
    expected_strokes: float
    risk_adjusted_score: float
    variance: float
    shot_cloud_summary: ShotCloudSummary
    explanation: str


class SimulationResponse(BaseModel):
    simulation_id: int | None = None
    player_name: str
    hole_id: str
    best_strategy: StrategySummary
    top_alternatives: list[StrategySummary]
    probabilities: ProbabilitySummary
    expected_strokes: float
    risk_adjusted_score: float
    variance: float
    shot_cloud_summary: ShotCloudSummary
    explanation: str
    ranked_strategy_count: int


class RecommendationHistoryItem(BaseModel):
    recommendation_id: int
    player_name: str
    hole_id: str
    created_at: str
    expected_strokes: float
    risk_adjusted_score: float
    penalty_probability: float
    explanation: str
    best_strategy: StrategySummary
