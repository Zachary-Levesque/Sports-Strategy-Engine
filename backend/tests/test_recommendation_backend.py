from __future__ import annotations

from fastapi.testclient import TestClient

from backend.app.main import app


client = TestClient(app)


def test_recommendation_response_contains_cloud_and_probabilities():
    response = client.post(
        "/recommendation",
        json={
            "player_name": "Maya",
            "hole_id": "harbor_par4",
            "iterations": 500,
            "risk_tolerance_override": "low",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["shot_mode"] == "tee"
    assert payload["lie"] == "tee"
    assert payload["shot_cloud_summary"]["sample_count"] > 0
    assert len(payload["shot_samples"]) > 0
    assert len(payload["shot_samples"]) <= 200
    assert payload["probabilities"]["penalty_probability"] >= 0.0
    assert len(payload["top_alternatives"]) == 3
    assert payload["recommendation_id"] is not None


def test_custom_shot_recommendation_response_contains_visualization_points():
    response = client.post(
        "/recommendation",
        json={
            "player_name": "Zachary",
            "hole_id": "harbor_par4",
            "iterations": 400,
            "shot_mode": "custom",
            "ball_position": {"x": 4, "y": 155},
            "lie": "fairway",
            "target_position": {"x": 0, "y": 355},
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["shot_mode"] == "custom"
    assert payload["lie"] == "fairway"
    assert payload["start_position"] == {"x": 4.0, "y": 155.0}
    assert payload["target_position"] == {"x": 0.0, "y": 355.0}
    assert payload["best_strategy"]["aim_point"]["y"] >= 155.0
    assert payload["shot_samples"][0]["surface"] in {
        "fairway",
        "rough",
        "green",
        "bunker",
        "water",
        "ob",
        "recovery",
    }
