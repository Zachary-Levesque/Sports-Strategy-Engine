from __future__ import annotations

from dataclasses import dataclass
from statistics import mean, pstdev


@dataclass(frozen=True)
class RiskProfile:
    variance_weight: float
    penalty_weight: float


@dataclass(frozen=True)
class StrategyMetrics:
    expected_strokes: float
    variance: float
    std_dev: float
    penalty_probability: float
    fairway_probability: float
    rough_probability: float
    green_probability: float
    bunker_probability: float
    water_probability: float
    ob_probability: float
    recovery_probability: float
    risk_adjusted_score: float


def risk_profile_for_tolerance(risk_tolerance: str) -> RiskProfile:
    table = {
        "low": RiskProfile(variance_weight=0.28, penalty_weight=2.1),
        "medium": RiskProfile(variance_weight=0.18, penalty_weight=1.55),
        "high": RiskProfile(variance_weight=0.1, penalty_weight=1.0),
    }
    return table.get(risk_tolerance, table["medium"])


def compute_risk_adjusted_score(
    expected_strokes: float,
    variance: float,
    penalty_probability: float,
    risk_tolerance: str,
) -> float:
    profile = risk_profile_for_tolerance(risk_tolerance)
    return expected_strokes + profile.variance_weight * variance + profile.penalty_weight * penalty_probability


def safe_variance(values: list[float]) -> float:
    if len(values) <= 1:
        return 0.0
    avg = mean(values)
    return sum((value - avg) ** 2 for value in values) / len(values)


def safe_std(values: list[float]) -> float:
    if len(values) <= 1:
        return 0.0
    return pstdev(values)
