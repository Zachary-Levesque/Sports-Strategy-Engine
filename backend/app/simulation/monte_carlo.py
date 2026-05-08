from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from math import hypot
from typing import Any

import numpy as np

from backend.app.simulation.hole_generator import Hole, Point, classify_surface
from backend.app.simulation.player_model import PlayerProfile, ShotOption, build_shot_distribution
from backend.app.simulation.risk_metrics import (
    StrategyMetrics,
    compute_risk_adjusted_score,
    safe_std,
    safe_variance,
)


@dataclass(frozen=True)
class ShotSample:
    x: float
    y: float
    surface: str
    total_strokes: float


@dataclass(frozen=True)
class SimulationResult:
    option: ShotOption
    metrics: StrategyMetrics
    samples: list[ShotSample]
    explanation_inputs: dict[str, Any]


LIE_STROKE_FACTORS = {
    "green": 0.28,
    "fairway": 0.95,
    "rough": 1.15,
    "bunker": 1.45,
    "water": 1.75,
    "ob": 2.0,
    "recovery": 1.6,
}


def estimate_strokes_remaining(distance_to_hole: float, surface: str, par: int) -> float:
    if surface == "green":
        return max(1.0, 1.0 + distance_to_hole / 45.0)
    base = 0.95 + distance_to_hole / 95.0
    lie_penalty = LIE_STROKE_FACTORS.get(surface, 1.2)
    par_adjustment = 0.05 if par >= 5 and distance_to_hole > 220 else 0.0
    return max(1.0, base + lie_penalty + par_adjustment)


def simulate_strategy(
    player: PlayerProfile,
    hole: Hole,
    option: ShotOption,
    iterations: int = 3000,
    lie: str = "tee",
    start_position: Point | None = None,
    rng_seed: int = 7,
    sample_cap: int = 350,
) -> SimulationResult:
    if iterations < 1:
        raise ValueError("iterations must be at least 1.")
    if sample_cap < 0:
        raise ValueError("sample_cap cannot be negative.")

    club = player.club_by_name(option.club)
    distribution = build_shot_distribution(
        player=player,
        club=club,
        option=option,
        lie=lie,
        wind_speed_mph=hole.wind.speed_mph,
        wind_direction_deg=hole.wind.direction_deg,
    )

    rng = np.random.default_rng(rng_seed)
    covariance = np.array(
        [
            [distribution.sigma_x**2, distribution.covariance_xy],
            [distribution.covariance_xy, distribution.sigma_y**2],
        ]
    )
    eigenvalues = np.linalg.eigvalsh(covariance)
    if np.any(eigenvalues < -1e-9):
        raise ValueError(f"Shot covariance matrix is not positive semidefinite: {covariance.tolist()}")
    start_y = start_position.y if start_position is not None else hole.tee.y
    mean = np.array([distribution.mean_x, distribution.mean_y + start_y])
    draws = rng.multivariate_normal(mean, covariance, size=iterations)

    strokes: list[float] = []
    surfaces: list[str] = []
    samples: list[ShotSample] = []
    penalties = 0

    for index, (x, y) in enumerate(draws):
        surface = classify_surface(hole, float(x), float(y))
        distance_to_hole = hypot(x - hole.green_center.x, y - hole.green_center.y)

        penalty = 1.0 if surface in {"water", "ob"} else 0.0
        continuation = estimate_strokes_remaining(distance_to_hole, surface, hole.par)
        total_strokes = 1.0 + penalty + continuation

        if surface in {"water", "ob"}:
            penalties += 1

        strokes.append(total_strokes)
        surfaces.append(surface)

        if index < min(sample_cap, iterations):
            samples.append(
                ShotSample(
                    x=float(x),
                    y=float(y),
                    surface=surface,
                    total_strokes=total_strokes,
                )
            )

    counts = Counter(surfaces)
    expected_strokes = float(np.mean(strokes))
    variance = safe_variance(strokes)
    penalty_probability = penalties / iterations
    if not np.isfinite(expected_strokes) or not np.isfinite(variance):
        raise ValueError("Simulation produced non-finite expected_strokes or variance.")
    metrics = StrategyMetrics(
        expected_strokes=expected_strokes,
        variance=variance,
        std_dev=safe_std(strokes),
        penalty_probability=penalty_probability,
        fairway_probability=counts["fairway"] / iterations,
        rough_probability=counts["rough"] / iterations,
        green_probability=counts["green"] / iterations,
        bunker_probability=counts["bunker"] / iterations,
        water_probability=counts["water"] / iterations,
        ob_probability=counts["ob"] / iterations,
        recovery_probability=counts["recovery"] / iterations,
        risk_adjusted_score=compute_risk_adjusted_score(
            expected_strokes=expected_strokes,
            variance=variance,
            penalty_probability=penalty_probability,
            risk_tolerance=player.risk_tolerance,
        ),
    )

    return SimulationResult(
        option=option,
        metrics=metrics,
        samples=samples,
        explanation_inputs={
            "mean_x": distribution.mean_x,
            "mean_y": distribution.mean_y,
            "expected_total_yards": distribution.expected_total_yards,
            "dispersion_x": distribution.sigma_x,
            "dispersion_y": distribution.sigma_y,
        },
    )
