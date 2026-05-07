from __future__ import annotations

import json

from backend.app.core.config import get_settings
from backend.app.core.exceptions import AppError
from backend.app.schemas.scenario import ScenarioSummary


def load_scenarios() -> list[ScenarioSummary]:
    settings = get_settings()
    try:
        raw = json.loads(settings.scenario_seed_path.read_text())
    except json.JSONDecodeError as exc:
        raise AppError(f"Invalid scenario JSON: {exc}") from exc
    return [ScenarioSummary(**item) for item in raw]
