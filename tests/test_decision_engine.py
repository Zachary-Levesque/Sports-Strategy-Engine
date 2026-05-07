from decision_engine import rank_strategies
from hole_generator import load_holes
from player_model import PlayerProfile, load_player_profiles


def test_decision_engine_returns_ranked_recommendation():
    players = load_player_profiles("data/player_profiles.json")
    holes = load_holes("data/generated_holes.json")
    recommendation = rank_strategies(players["Zachary"], holes["harbor_par4"], iterations=600)
    assert recommendation.best.metrics.risk_adjusted_score <= recommendation.ranked_strategies[1].metrics.risk_adjusted_score
    assert recommendation.explanation


def test_low_risk_override_prefers_lower_penalty_top_option():
    players = load_player_profiles("data/player_profiles.json")
    holes = load_holes("data/generated_holes.json")
    player = players["Zachary"]
    hole = holes["harbor_par4"]

    medium = rank_strategies(player, hole, iterations=600, risk_tolerance_override="medium")
    low = rank_strategies(player, hole, iterations=600, risk_tolerance_override="low")

    assert low.best.metrics.penalty_probability <= medium.best.metrics.penalty_probability + 0.03
