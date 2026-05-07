from __future__ import annotations

import json

from backend.app.core.config import get_settings
from backend.app.schemas.scenario import ScenarioSummary


def load_scenarios() -> list[ScenarioSummary]:
    settings = get_settings()
    raw = json.loads(settings.scenario_seed_path.read_text())
    return [ScenarioSummary(**item) for item in raw]
