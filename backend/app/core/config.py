from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import os
from pathlib import Path

from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[3]
load_dotenv(ROOT / ".env")


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    app_name: str
    app_version: str
    debug: bool
    database_url: str
    cors_origins: list[str]
    default_iterations: int
    log_level: str
    data_dir: Path
    player_seed_path: Path
    hole_seed_path: Path
    scenario_seed_path: Path


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    data_dir = ROOT / "data"
    default_db_path = ROOT / "data" / "sports_strategy_engine.db"
    cors_default = "http://localhost:5173,http://127.0.0.1:5173"

    return Settings(
        app_name=os.getenv("SPORTS_STRATEGY_APP_NAME", "Sports Strategy Engine API"),
        app_version=os.getenv("SPORTS_STRATEGY_APP_VERSION", "1.0.0"),
        debug=os.getenv("SPORTS_STRATEGY_DEBUG", "false").lower() == "true",
        database_url=os.getenv(
            "SPORTS_STRATEGY_DATABASE_URL",
            f"sqlite:///{default_db_path}",
        ),
        cors_origins=_split_csv(os.getenv("SPORTS_STRATEGY_CORS_ORIGINS", cors_default)),
        default_iterations=int(os.getenv("SPORTS_STRATEGY_DEFAULT_ITERATIONS", "3000")),
        log_level=os.getenv("SPORTS_STRATEGY_LOG_LEVEL", "INFO").upper(),
        data_dir=data_dir,
        player_seed_path=data_dir / "player_profiles.json",
        hole_seed_path=data_dir / "generated_holes.json",
        scenario_seed_path=data_dir / "scenarios.json",
    )
