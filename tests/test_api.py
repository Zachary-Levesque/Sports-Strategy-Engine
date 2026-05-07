from fastapi.testclient import TestClient

from api.main import app


client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["database"] == "ok"


def test_catalog_endpoints_return_seed_data():
    players = client.get("/players")
    holes = client.get("/holes")
    scenarios = client.get("/scenarios")

    assert players.status_code == 200
    assert holes.status_code == 200
    assert scenarios.status_code == 200

    assert any(item["player_name"] == "Zachary" for item in players.json())
    assert any(item["hole_id"] == "harbor_par4" for item in holes.json())
    assert any(item["player_name"] == "Zachary" for item in scenarios.json())


def test_recommendation_endpoint_returns_expected_shape():
    response = client.post(
        "/recommendation",
        json={
            "player_name": "Zachary",
            "hole_id": "harbor_par4",
            "iterations": 500,
            "risk_tolerance_override": "medium",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["player_name"] == "Zachary"
    assert payload["hole_id"] == "harbor_par4"
    assert "best_strategy" in payload
    assert len(payload["top_alternatives"]) == 3
    assert payload["best_strategy"]["club"]
    assert "expected_strokes" in payload
    assert "ob_probability" in payload["probabilities"]


def test_recommendation_unknown_player_returns_404():
    response = client.post(
        "/recommendation",
        json={
            "player_name": "Unknown",
            "hole_id": "harbor_par4",
            "iterations": 500,
        },
    )
    assert response.status_code == 404
