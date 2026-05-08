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
    first_player_name = players.json()[0]["player_name"]

    response = client.get(f"/players/{first_player_name}")
    assert response.status_code == 200
    payload = response.json()
    assert payload["player_name"] == first_player_name
    assert len(payload["clubs"]) >= 1


def test_hole_detail_endpoint():
    holes = client.get("/holes")
    assert holes.status_code == 200
    first_hole_id = holes.json()[0]["hole_id"]

    response = client.get(f"/holes/{first_hole_id}")
    assert response.status_code == 200
    payload = response.json()
    assert payload["hole_id"] == first_hole_id
    assert "hazards" in payload
    assert payload["tee"]["x"] == 0
    assert payload["green_center"]["y"] > payload["tee"]["y"]


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
    assert len(payload["shot_samples"]) > 0
    assert payload["start_position"]["y"] == 0.0

    with SessionLocal() as db:
        record = db.query(RecommendationORM).filter(RecommendationORM.id == payload["simulation_id"]).first()
        assert record is not None


def test_simulate_endpoint_supports_custom_shot_mode():
    response = client.post(
        "/simulate",
        json={
            "player_name": "Zachary",
            "hole_id": "harbor_par4",
            "iterations": 300,
            "shot_mode": "custom",
            "ball_position": {"x": -6, "y": 140},
            "lie": "rough",
            "target_position": {"x": 3, "y": 330},
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["shot_mode"] == "custom"
    assert payload["lie"] == "rough"
    assert payload["start_position"] == {"x": -6.0, "y": 140.0}
    assert payload["target_position"] == {"x": 3.0, "y": 330.0}


def test_update_and_delete_player_flow():
    unique_name = f"CRUD Player {uuid4().hex[:8]}"
    create_payload = {
        "player_name": unique_name,
        "handicap": 12,
        "handedness": "right",
        "preferred_shape": "straight",
        "miss_tendency": "center",
        "risk_tolerance": "low",
        "clubs": [
            {
                "club": "5-Iron",
                "carry_yards": 185,
                "total_yards": 192,
                "lateral_sigma": 14,
                "distance_sigma": 10,
                "confidence": 0.82,
                "shape_bias": 0.0,
                "lie_adjustment_sensitivity": 0.08,
            }
        ],
    }
    assert client.post("/players", json=create_payload).status_code == 201

    updated_payload = {**create_payload, "player_name": f"{unique_name} Updated", "handicap": 9}
    update_response = client.put(f"/players/{unique_name}", json=updated_payload)
    assert update_response.status_code == 200
    assert update_response.json()["player_name"] == updated_payload["player_name"]

    delete_response = client.delete(f"/players/{updated_payload['player_name']}")
    assert delete_response.status_code == 204


def test_create_update_delete_hole_flow():
    hole_id = f"test_hole_{uuid4().hex[:8]}"
    create_payload = {
        "hole_id": hole_id,
        "name": "Test Hole",
        "par": 4,
        "yardage": 410,
        "tee": {"x": 0, "y": 0},
        "green_center": {"x": 0, "y": 410},
        "green_radius": 18,
        "fairway_center_x": 0,
        "fairway_width": 32,
        "fairway_start_y": 40,
        "fairway_end_y": 380,
        "rough_width": 18,
        "hazards": [{"kind": "bunker", "shape": "circle", "center_x": 10, "center_y": 330, "radius": 10, "penalty_strokes": 0}],
        "wind": {"speed_mph": 7, "direction_deg": 45},
    }
    assert client.post("/holes", json=create_payload).status_code == 201

    updated_payload = {**create_payload, "hole_id": f"{hole_id}_updated", "name": "Updated Test Hole"}
    update_response = client.put(f"/holes/{hole_id}", json=updated_payload)
    assert update_response.status_code == 200
    assert update_response.json()["hole_id"] == updated_payload["hole_id"]

    delete_response = client.delete(f"/holes/{updated_payload['hole_id']}")
    assert delete_response.status_code == 204
