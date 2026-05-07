from __future__ import annotations

from pathlib import Path
import json
import sys


ROOT = Path(__file__).resolve().parent.parent
PYTHON_DIR = ROOT / "python"
if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

from decision_engine import Recommendation, rank_strategies
from hole_generator import Hole, load_holes
from player_model import PlayerProfile, load_player_profiles


DATA_DIR = ROOT / "data"
PLAYER_PATH = DATA_DIR / "player_profiles.json"
HOLE_PATH = DATA_DIR / "generated_holes.json"
SCENARIO_PATH = DATA_DIR / "scenarios.json"


def load_players() -> dict[str, PlayerProfile]:
    return load_player_profiles(PLAYER_PATH)


def load_hole_catalog() -> dict[str, Hole]:
    return load_holes(HOLE_PATH)


def load_scenarios() -> list[dict[str, object]]:
    return json.loads(SCENARIO_PATH.read_text())


def get_player(player_name: str) -> PlayerProfile:
    players = load_players()
    if player_name not in players:
        raise KeyError(f"Unknown player_name: {player_name}")
    return players[player_name]


def get_hole(hole_id: str) -> Hole:
    holes = load_hole_catalog()
    if hole_id not in holes:
        raise KeyError(f"Unknown hole_id: {hole_id}")
    return holes[hole_id]


def compute_recommendation(
    player_name: str,
    hole_id: str,
    iterations: int,
    risk_tolerance_override: str | None = None,
) -> Recommendation:
    player = get_player(player_name)
    hole = get_hole(hole_id)
    return rank_strategies(
        player=player,
        hole=hole,
        iterations=iterations,
        risk_tolerance_override=risk_tolerance_override,
    )
