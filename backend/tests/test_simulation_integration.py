from __future__ import annotations

from backend.app.database.database import SessionLocal
from backend.app.services.hole_service import get_hole_by_external_id, to_domain as hole_to_domain
from backend.app.services.player_service import get_player_by_name, to_domain as player_to_domain
from backend.app.simulation.decision_engine import rank_strategies


def test_low_risk_profile_produces_ranked_recommendation():
    with SessionLocal() as db:
        player = player_to_domain(get_player_by_name(db, "Maya"))
        hole = hole_to_domain(get_hole_by_external_id(db, "harbor_par4"))

    recommendation = rank_strategies(player=player, hole=hole, iterations=450)
    assert recommendation.best.metrics.penalty_probability >= 0.0
    assert len(recommendation.ranked_strategies) >= 4
