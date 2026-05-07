from __future__ import annotations

from fastapi.testclient import TestClient

from backend.app.main import app


client = TestClient(app)


def test_scenarios_endpoint_returns_seeded_rows():
    response = client.get("/scenarios")
    assert response.status_code == 200
    payload = response.json()
    assert len(payload) >= 1
    assert "name" in payload[0]


def test_recommendation_history_endpoint_returns_saved_items():
    client.post(
        "/recommendation",
        json={
            "player_name": "Zachary",
            "hole_id": "harbor_par4",
            "iterations": 200,
            "risk_tolerance_override": "medium",
        },
    )
    response = client.get("/recommendations/history")
    assert response.status_code == 200
    payload = response.json()
    assert len(payload) >= 1
    assert "best_strategy" in payload[0]
