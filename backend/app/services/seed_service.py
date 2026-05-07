from __future__ import annotations

import json

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.core.config import get_settings
from backend.app.core.exceptions import AppError
from backend.app.models.orm import ClubORM, HoleORM, PlayerORM, ScenarioORM
from backend.app.utils.serialization import dumps


def seed_database_if_empty(db: Session) -> None:
    player_count = db.scalar(select(func.count()).select_from(PlayerORM)) or 0
    hole_count = db.scalar(select(func.count()).select_from(HoleORM)) or 0
    scenario_count = db.scalar(select(func.count()).select_from(ScenarioORM)) or 0
    if player_count > 0 and hole_count > 0 and scenario_count > 0:
        return

    settings = get_settings()
    if player_count == 0:
        try:
            player_data = json.loads(settings.player_seed_path.read_text())
        except json.JSONDecodeError as exc:
            raise AppError(f"Invalid player seed JSON: {exc}") from exc
        for item in player_data:
            player = PlayerORM(
                player_name=item["player_name"],
                handicap=item["handicap"],
                handedness=item.get("handedness", "right"),
                preferred_shape=item["preferred_shape"],
                miss_tendency=item["miss_tendency"],
                risk_tolerance=item["risk_tolerance"],
            )
            player.clubs = [ClubORM(**club) for club in item["clubs"]]
            db.add(player)

    if hole_count == 0:
        try:
            hole_data = json.loads(settings.hole_seed_path.read_text())
        except json.JSONDecodeError as exc:
            raise AppError(f"Invalid hole seed JSON: {exc}") from exc
        for item in hole_data:
            db.add(
                HoleORM(
                    external_hole_id=item["hole_id"],
                    name=item["name"],
                    par=item["par"],
                    yardage=item["yardage"],
                    tee_x=item["tee"]["x"],
                    tee_y=item["tee"]["y"],
                    green_center_x=item["green_center"]["x"],
                    green_center_y=item["green_center"]["y"],
                    green_radius=item["green_radius"],
                    fairway_center_x=item["fairway_center_x"],
                    fairway_width=item["fairway_width"],
                    fairway_start_y=item["fairway_start_y"],
                    fairway_end_y=item["fairway_end_y"],
                    rough_width=item["rough_width"],
                    hazards_json=dumps(item.get("hazards", [])),
                    wind_speed_mph=item["wind"]["speed_mph"],
                    wind_direction_deg=item["wind"]["direction_deg"],
                )
            )

    if scenario_count == 0:
        try:
            scenario_data = json.loads(settings.scenario_seed_path.read_text())
        except json.JSONDecodeError as exc:
            raise AppError(f"Invalid scenario seed JSON: {exc}") from exc
        for item in scenario_data:
            db.add(
                ScenarioORM(
                    name=item["name"],
                    player_name=item["player_name"],
                    hole_id=item["hole_id"],
                    iterations=item["iterations"],
                    risk_tolerance_override=item.get("risk_tolerance_override"),
                )
            )

    db.commit()
