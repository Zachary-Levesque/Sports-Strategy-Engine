from __future__ import annotations

from pathlib import Path
import json
import sys


ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from decision_engine import rank_strategies
from hole_generator import load_holes
from player_model import load_player_profiles
from visualize import plot_hole_layout


DATA_DIR = ROOT / "data"
RESULTS_DIR = ROOT / "results"


def main() -> None:
    players = load_player_profiles(DATA_DIR / "player_profiles.json")
    holes = load_holes(DATA_DIR / "generated_holes.json")
    scenarios = json.loads((DATA_DIR / "scenarios.json").read_text())

    scenario = scenarios[0]
    player = players[scenario["player_name"]]
    hole = holes[scenario["hole_id"]]
    iterations = scenario.get("iterations", 3000)
    risk_override = scenario.get("risk_tolerance_override")

    recommendation = rank_strategies(
        player=player,
        hole=hole,
        iterations=iterations,
        risk_tolerance_override=risk_override,
    )

    plot_path = plot_hole_layout(
        hole=hole,
        result=recommendation.best,
        output_path=RESULTS_DIR / "plots" / f"{hole.hole_id}_{player.player_name.lower()}_recommendation.png",
    )

    best = recommendation.best
    print(f"Player: {player.player_name}")
    print(f"Hole: {hole.name} (Par {hole.par}, {hole.yardage:.0f} yards)")
    print(f"Wind: {hole.wind.speed_mph:.0f} mph at {hole.wind.direction_deg:.0f} degrees")
    print()
    print("Recommended strategy")
    print(f"  Club: {best.option.club}")
    print(f"  Aim point: {best.option.aim_label} at ({best.option.aim_x:.1f}, {best.option.aim_y:.1f})")
    print(f"  Shot shape: {best.option.shot_shape}")
    print(f"  Swing intensity: {int(best.option.swing_intensity * 100)}%")
    print(f"  Expected strokes: {best.metrics.expected_strokes:.2f}")
    print(f"  Risk-adjusted score: {best.metrics.risk_adjusted_score:.2f}")
    print(f"  Penalty probability: {best.metrics.penalty_probability:.1%}")
    print(f"  Fairway probability: {best.metrics.fairway_probability:.1%}")
    print(f"  Rough probability: {best.metrics.rough_probability:.1%}")
    print(f"  Green probability: {best.metrics.green_probability:.1%}")
    print(f"  Variance: {best.metrics.variance:.3f}")
    print()
    print("Reason")
    print(f"  {recommendation.explanation}")
    print()
    print("Top alternatives")
    for index, result in enumerate(recommendation.ranked_strategies[:3], start=1):
        print(
            f"  {index}. {result.option.club}, {result.option.aim_label}, "
            f"{result.option.shot_shape}, {int(result.option.swing_intensity * 100)}% "
            f"=> score {result.metrics.risk_adjusted_score:.2f}, "
            f"expected {result.metrics.expected_strokes:.2f}, penalty {result.metrics.penalty_probability:.1%}"
        )
    print()
    print(f"Plot saved to: {plot_path}")


if __name__ == "__main__":
    main()
