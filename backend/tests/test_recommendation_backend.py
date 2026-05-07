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
    assert payload["shot_cloud_summary"]["sample_count"] > 0
    assert payload["probabilities"]["penalty_probability"] >= 0.0
    assert len(payload["top_alternatives"]) == 3
    assert payload["recommendation_id"] is not None
