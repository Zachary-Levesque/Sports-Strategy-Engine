from __future__ import annotations

from dataclasses import dataclass
from math import sqrt

from hole_generator import Hole
from monte_carlo import SimulationResult, simulate_strategy
from player_model import PlayerProfile, ShotOption


@dataclass(frozen=True)
class Recommendation:
    best: SimulationResult
    ranked_strategies: list[SimulationResult]
    explanation: str


def generate_shot_options(player: PlayerProfile, hole: Hole) -> list[ShotOption]:
    options: list[ShotOption] = []
    intensities = [0.7, 0.8, 0.9, 1.0]
    shapes = ["straight", "draw", "fade"]
    fairway_center = (hole.fairway_center_x, min(hole.yardage * 0.62, hole.fairway_end_y - 6))
    fairway_left = (hole.fairway_center_x - hole.fairway_width * 0.22, fairway_center[1])
    fairway_right = (hole.fairway_center_x + hole.fairway_width * 0.22, fairway_center[1])
    green_center = (hole.green_center.x, hole.green_center.y)
    front_green = (hole.green_center.x, hole.green_center.y - hole.green_radius * 0.6)

    targets = [
        ("center fairway", *fairway_center),
        ("left fairway", *fairway_left),
        ("right fairway", *fairway_right),
        ("center green", *green_center),
        ("front green", *front_green),
    ]

    for club in player.clubs:
        for aim_label, aim_x, aim_y in targets:
            if aim_label.endswith("green") and club.carry_yards < hole.yardage * 0.45:
                continue
            for shape in shapes:
                for intensity in intensities:
                    projected_carry = club.carry_yards * (0.55 + 0.45 * intensity)
                    if aim_label == "center green" and projected_carry < hole.yardage - 50:
                        continue
                    if aim_label.startswith("center fairway") and projected_carry > hole.yardage + 20:
                        continue
                    options.append(
                        ShotOption(
                            club=club.club,
                            aim_x=aim_x,
                            aim_y=aim_y,
                            aim_label=aim_label,
                            shot_shape=shape,
                            swing_intensity=intensity,
                        )
                    )
    return options


def explain_decision(best: SimulationResult, runner_up: SimulationResult | None) -> str:
    pieces = [
        f"{best.option.club} to {best.option.aim_label} is best because it produced the lowest risk-adjusted score."
    ]
    if best.metrics.penalty_probability < 0.05:
        pieces.append("Penalty exposure stayed low.")
    elif best.metrics.penalty_probability < (runner_up.metrics.penalty_probability if runner_up else 1.0):
        pieces.append("It reduced penalty exposure versus more aggressive options.")

    if best.metrics.fairway_probability + best.metrics.green_probability > 0.55:
        pieces.append("The landing distribution stayed in playable areas often.")

    if runner_up and best.metrics.expected_strokes > runner_up.metrics.expected_strokes:
        pieces.append("It gave up a small amount of raw upside in exchange for tighter variance.")
    elif runner_up and best.metrics.expected_strokes < runner_up.metrics.expected_strokes:
        pieces.append("It also led the field on expected strokes, not only safety.")

    return " ".join(pieces)


def rank_strategies(
    player: PlayerProfile,
    hole: Hole,
    iterations: int = 3000,
    risk_tolerance_override: str | None = None,
) -> Recommendation:
    options = generate_shot_options(player, hole)
    if not options:
        raise ValueError("No candidate shot options were generated.")

    effective_player = player
    if risk_tolerance_override:
        effective_player = PlayerProfile(
            player_name=player.player_name,
            handicap=player.handicap,
            handedness=player.handedness,
            preferred_shape=player.preferred_shape,
            miss_tendency=player.miss_tendency,
            risk_tolerance=risk_tolerance_override,
            clubs=player.clubs,
        )

    results = [
        simulate_strategy(
            player=effective_player,
            hole=hole,
            option=option,
            iterations=iterations,
            rng_seed=17 + index,
        )
        for index, option in enumerate(options)
    ]
    ranked = sorted(
        results,
        key=lambda result: (
            result.metrics.risk_adjusted_score,
            result.metrics.expected_strokes,
            sqrt(result.metrics.variance),
        ),
    )
    explanation = explain_decision(ranked[0], ranked[1] if len(ranked) > 1 else None)
    return Recommendation(best=ranked[0], ranked_strategies=ranked, explanation=explanation)
