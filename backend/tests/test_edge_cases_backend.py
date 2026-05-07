from __future__ import annotations

import json

import pytest

from backend.app.schemas.player import ClubCreate
from backend.app.services.scenario_service import load_scenarios
from backend.app.simulation.hole_generator import Hole, Point, Wind, generate_hole
from backend.app.simulation.monte_carlo import simulate_strategy
from backend.app.simulation.player_model import Club, PlayerProfile, ShotOption, build_shot_distribution, load_player_profiles


def _edge_player(**overrides) -> PlayerProfile:
    club = Club(
        club="Driver",
        carry_yards=overrides.pop("carry_yards", 250),
        total_yards=overrides.pop("total_yards", 270),
        lateral_sigma=overrides.pop("lateral_sigma", 20),
        distance_sigma=overrides.pop("distance_sigma", 15),
        confidence=overrides.pop("confidence", 0.8),
    )
    return PlayerProfile(
        player_name="Edge",
        handicap=0,
        handedness="right",
        preferred_shape=overrides.pop("preferred_shape", "straight"),
        miss_tendency=overrides.pop("miss_tendency", "center"),
        risk_tolerance=overrides.pop("risk_tolerance", "medium"),
        clubs=[club],
    )


def _edge_hole(wind_speed: float = 0.0, wind_direction: float = 0.0, fairway_width: float = 34.0) -> Hole:
    return Hole(
        hole_id="edge",
        name="Edge",
        par=4,
        yardage=400,
        tee=Point(0.0, 0.0),
        green_center=Point(0.0, 400.0),
        green_radius=18.0,
        fairway_center_x=0.0,
        fairway_width=fairway_width,
        fairway_start_y=40.0,
        fairway_end_y=380.0,
        rough_width=18.0,
        hazards=[],
        wind=Wind(speed_mph=wind_speed, direction_deg=wind_direction),
    )


def test_extreme_crosswind_stays_finite():
    player = _edge_player()
    hole = _edge_hole(wind_speed=80.0, wind_direction=90.0)
    option = ShotOption("Driver", 0.0, 250.0, "center fairway", "fade", 1.0)
    result = simulate_strategy(player, hole, option, iterations=250, rng_seed=5)
    assert result.metrics.expected_strokes > 0
    assert 0.0 <= result.metrics.penalty_probability <= 1.0


def test_zero_wind_distribution_has_no_wind_bias():
    player = _edge_player()
    option = ShotOption("Driver", 0.0, 250.0, "center fairway", "straight", 1.0)
    distribution = build_shot_distribution(player, player.clubs[0], option, "tee", 0.0, 0.0)
    assert distribution.mean_x == pytest.approx(0.0)


def test_invalid_shot_shape_is_rejected():
    with pytest.raises(ValueError, match="Unsupported shot_shape"):
        ShotOption("Driver", 0.0, 200.0, "center fairway", "slice", 1.0)


def test_invalid_iterations_are_rejected():
    player = _edge_player()
    hole = _edge_hole()
    option = ShotOption("Driver", 0.0, 250.0, "center fairway", "straight", 1.0)
    with pytest.raises(ValueError, match="iterations must be at least 1"):
        simulate_strategy(player, hole, option, iterations=0)


def test_generate_hole_invalid_par_is_rejected():
    with pytest.raises(ValueError, match="supports only par 3, 4, or 5"):
        generate_hole(6)


def test_invalid_club_schema_rejects_total_less_than_carry():
    with pytest.raises(ValueError, match="total_yards cannot be less than carry_yards"):
        ClubCreate(
            club="Driver",
            carry_yards=250,
            total_yards=240,
            lateral_sigma=20,
            distance_sigma=15,
            confidence=0.8,
        )


def test_malformed_player_json_raises_clear_error(tmp_path):
    path = tmp_path / "players.json"
    path.write_text("{bad json")
    with pytest.raises(ValueError, match="Invalid player profile JSON"):
        load_player_profiles(path)


def test_empty_scenarios_file_is_allowed(tmp_path, monkeypatch):
    path = tmp_path / "scenarios.json"
    path.write_text("[]")

    class DummySettings:
        scenario_seed_path = path

    monkeypatch.setattr("backend.app.services.scenario_service.get_settings", lambda: DummySettings())
    assert load_scenarios() == []


def test_probability_mass_sums_to_one_for_narrow_fairway():
    player = _edge_player(lateral_sigma=35)
    hole = _edge_hole(fairway_width=8.0)
    option = ShotOption("Driver", 0.0, 250.0, "center fairway", "straight", 1.0)
    result = simulate_strategy(player, hole, option, iterations=300, rng_seed=9)
    total = (
        result.metrics.fairway_probability
        + result.metrics.rough_probability
        + result.metrics.green_probability
        + result.metrics.bunker_probability
        + result.metrics.water_probability
        + result.metrics.ob_probability
        + result.metrics.recovery_probability
    )
    assert total == pytest.approx(1.0)
