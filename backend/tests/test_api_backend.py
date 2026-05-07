from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient

from backend.app.database.database import SessionLocal
from backend.app.main import app
from backend.app.models.orm import PlayerORM, RecommendationORM


client = TestClient(app)


def test_player_detail_endpoint():
    players = client.get("/players")
    assert players.status_code == 200
    first_player_id = players.json()[0]["id"]

    response = client.get(f"/players/{first_player_id}")
    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == first_player_id
    assert len(payload["clubs"]) >= 1


def test_hole_detail_endpoint():
    holes = client.get("/holes")
    assert holes.status_code == 200
    first_hole_id = holes.json()[0]["id"]

    response = client.get(f"/holes/{first_hole_id}")
    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == first_hole_id
    assert "hazards" in payload


def test_create_player_persists_to_database():
    unique_name = f"Test Player {uuid4().hex[:8]}"
    response = client.post(
        "/players",
        json={
            "player_name": unique_name,
            "handicap": 8,
            "handedness": "right",
            "preferred_shape": "fade",
            "miss_tendency": "right",
            "risk_tolerance": "medium",
            "clubs": [
                {
                    "club": "Driver",
                    "carry_yards": 255,
                    "total_yards": 275,
                    "lateral_sigma": 20,
                    "distance_sigma": 15,
                    "confidence": 0.75,
                    "shape_bias": 2.0,
                    "lie_adjustment_sensitivity": 0.08,
                }
            ],
        },
    )
    assert response.status_code == 201
    payload = response.json()
    assert payload["player_name"] == unique_name

    with SessionLocal() as db:
        record = db.query(PlayerORM).filter(PlayerORM.player_name == unique_name).first()
        assert record is not None
        db.delete(record)
        db.commit()


def test_simulate_endpoint_returns_saved_result_metadata():
    response = client.post(
        "/simulate",
        json={
            "player_name": "Zachary",
            "hole_id": "harbor_par4",
            "iterations": 400,
            "risk_tolerance_override": "medium",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["simulation_id"] is not None
    assert payload["ranked_strategy_count"] > len(payload["top_alternatives"])

    with SessionLocal() as db:
        record = db.query(RecommendationORM).filter(RecommendationORM.id == payload["simulation_id"]).first()
        assert record is not None
