from __future__ import annotations

import json
from statistics import mean
import time
from typing import NamedTuple

from sqlalchemy.orm import Session

from backend.app.core.exceptions import SimulationError
from backend.app.models.orm import RecommendationORM
from backend.app.schemas.recommendation import (
    AimPointSchema,
    ProbabilitySummary,
    RecommendationHistoryItem,
    RecommendationRequest,
    RecommendationResponse,
    ShotCloudSummary,
    SimulationResponse,
    StrategySummary,
)
from backend.app.services.hole_service import get_hole_by_external_id, to_domain as hole_to_domain
from backend.app.services.player_service import get_player_by_name, to_domain as player_to_domain
from backend.app.simulation.decision_engine import rank_strategies
from backend.app.simulation.monte_carlo import SimulationResult
from backend.app.utils.serialization import dumps


class RecommendationComputation(NamedTuple):
    response: RecommendationResponse
    ranked_strategy_count: int


def _strategy_summary(result: SimulationResult) -> StrategySummary:
    return StrategySummary(
        club=result.option.club,
        aim_label=result.option.aim_label,
        aim_point=AimPointSchema(x=result.option.aim_x, y=result.option.aim_y),
        shot_shape=result.option.shot_shape,
        swing_intensity=result.option.swing_intensity,
        expected_strokes=result.metrics.expected_strokes,
        risk_adjusted_score=result.metrics.risk_adjusted_score,
        penalty_probability=result.metrics.penalty_probability,
        fairway_probability=result.metrics.fairway_probability,
        rough_probability=result.metrics.rough_probability,
        green_probability=result.metrics.green_probability,
        bunker_probability=result.metrics.bunker_probability,
        water_probability=result.metrics.water_probability,
        ob_probability=result.metrics.ob_probability,
        variance=result.metrics.variance,
    )


def _probability_summary(result: SimulationResult) -> ProbabilitySummary:
    return ProbabilitySummary(
        penalty_probability=result.metrics.penalty_probability,
        fairway_probability=result.metrics.fairway_probability,
        rough_probability=result.metrics.rough_probability,
        green_probability=result.metrics.green_probability,
        bunker_probability=result.metrics.bunker_probability,
        water_probability=result.metrics.water_probability,
        ob_probability=result.metrics.ob_probability,
        recovery_probability=result.metrics.recovery_probability,
    )


def _shot_cloud_summary(result: SimulationResult) -> ShotCloudSummary:
    if not result.samples:
        return ShotCloudSummary(
            sample_count=0,
            centroid=AimPointSchema(x=0.0, y=0.0),
            x_range=[0.0, 0.0],
            y_range=[0.0, 0.0],
        )

    xs = [sample.x for sample in result.samples]
    ys = [sample.y for sample in result.samples]
    return ShotCloudSummary(
        sample_count=len(result.samples),
        centroid=AimPointSchema(x=mean(xs), y=mean(ys)),
        x_range=[min(xs), max(xs)],
        y_range=[min(ys), max(ys)],
    )


def _persist_result(
    db: Session,
    payload: RecommendationRequest,
    response: RecommendationResponse,
    player_id: int,
    hole_id: int,
    risk_tolerance_used: str,
    duration_ms: float,
) -> int:
    record = RecommendationORM(
        player_id=player_id,
        hole_id=hole_id,
        iterations=payload.iterations,
        risk_tolerance_used=risk_tolerance_used,
        explanation=response.explanation,
        expected_strokes=response.expected_strokes,
        risk_adjusted_score=response.risk_adjusted_score,
        variance=response.variance,
        penalty_probability=response.probabilities.penalty_probability,
        best_strategy_json=dumps(response.best_strategy.model_dump()),
        top_alternatives_json=dumps([item.model_dump() for item in response.top_alternatives]),
        probabilities_json=dumps(response.probabilities.model_dump()),
        shot_cloud_summary_json=dumps(response.shot_cloud_summary.model_dump()),
        duration_ms=duration_ms,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record.id


def build_recommendation_response(
    payload: RecommendationRequest,
    result,
    recommendation_id: int | None = None,
) -> RecommendationResponse:
    best = _strategy_summary(result.best)
    probabilities = _probability_summary(result.best)
    shot_cloud_summary = _shot_cloud_summary(result.best)

    return RecommendationResponse(
        recommendation_id=recommendation_id,
        player_name=payload.player_name,
        hole_id=payload.hole_id,
        best_strategy=best,
        top_alternatives=[_strategy_summary(item) for item in result.ranked_strategies[1:4]],
        probabilities=probabilities,
        expected_strokes=result.best.metrics.expected_strokes,
        risk_adjusted_score=result.best.metrics.risk_adjusted_score,
        variance=result.best.metrics.variance,
        shot_cloud_summary=shot_cloud_summary,
        explanation=result.explanation,
    )


def _compute(db: Session, payload: RecommendationRequest) -> RecommendationComputation:
    player = get_player_by_name(db, payload.player_name)
    hole = get_hole_by_external_id(db, payload.hole_id)
    resolved_player = player_to_domain(player, payload.risk_tolerance_override)

    started = time.perf_counter()
    try:
        result = rank_strategies(
            player=resolved_player,
            hole=hole_to_domain(hole),
            iterations=payload.iterations,
            risk_tolerance_override=payload.risk_tolerance_override,
        )
    except Exception as exc:  # pragma: no cover - surfaced via tests through API handler
        raise SimulationError(f"Simulation failed: {exc}") from exc

    duration_ms = (time.perf_counter() - started) * 1000
    response = build_recommendation_response(payload, result)
    response = response.model_copy(
        update={
            "recommendation_id": _persist_result(
                db=db,
                payload=payload,
                response=response,
                player_id=player.id,
                hole_id=hole.id,
                risk_tolerance_used=resolved_player.risk_tolerance,
                duration_ms=duration_ms,
            )
        }
    )
    return RecommendationComputation(response=response, ranked_strategy_count=len(result.ranked_strategies))


def compute_recommendation(db: Session, payload: RecommendationRequest) -> RecommendationResponse:
    return _compute(db, payload).response


def simulate(db: Session, payload: RecommendationRequest) -> SimulationResponse:
    computation = _compute(db, payload)
    response = computation.response
    return SimulationResponse(
        simulation_id=response.recommendation_id,
        player_name=response.player_name,
        hole_id=response.hole_id,
        best_strategy=response.best_strategy,
        top_alternatives=response.top_alternatives,
        probabilities=response.probabilities,
        expected_strokes=response.expected_strokes,
        risk_adjusted_score=response.risk_adjusted_score,
        variance=response.variance,
        shot_cloud_summary=response.shot_cloud_summary,
        explanation=response.explanation,
        ranked_strategy_count=computation.ranked_strategy_count,
    )


def list_recommendation_history(db: Session, limit: int = 50) -> list[RecommendationHistoryItem]:
    rows = (
        db.query(RecommendationORM)
        .order_by(RecommendationORM.created_at.desc(), RecommendationORM.id.desc())
        .limit(limit)
        .all()
    )
    return [
        RecommendationHistoryItem(
            recommendation_id=row.id,
            player_name=row.player.player_name,
            hole_id=row.hole.external_hole_id,
            created_at=row.created_at.isoformat(),
            expected_strokes=row.expected_strokes,
            risk_adjusted_score=row.risk_adjusted_score,
            penalty_probability=row.penalty_probability,
            explanation=row.explanation,
            best_strategy=StrategySummary(**json.loads(row.best_strategy_json)),
        )
        for row in rows
    ]
