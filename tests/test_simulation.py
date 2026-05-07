from hole_generator import load_holes
from monte_carlo import simulate_strategy
from player_model import ShotOption, load_player_profiles


def test_water_hazard_increases_penalty_probability():
    players = load_player_profiles("data/player_profiles.json")
    holes = load_holes("data/generated_holes.json")
    player = players["Zachary"]
    hole = holes["harbor_par4"]

    aggressive = ShotOption("Driver", 22.0, 258.0, "water edge", "fade", 1.0)
    safe = ShotOption("4-Iron", -10.0, 215.0, "safe layup", "straight", 0.9)

    aggressive_result = simulate_strategy(player, hole, aggressive, iterations=1200, rng_seed=1)
    safe_result = simulate_strategy(player, hole, safe, iterations=1200, rng_seed=2)

    assert aggressive_result.metrics.penalty_probability > safe_result.metrics.penalty_probability


def test_simulation_returns_playable_metrics():
    players = load_player_profiles("data/player_profiles.json")
    holes = load_holes("data/generated_holes.json")
    player = players["Maya"]
    hole = holes["ridge_par3"]
    option = ShotOption("7-Iron", 0.0, 176.0, "center green", "draw", 1.0)
    result = simulate_strategy(player, hole, option, iterations=800, rng_seed=4)
    assert result.metrics.expected_strokes > 1.0
    assert 0.0 <= result.metrics.green_probability <= 1.0
