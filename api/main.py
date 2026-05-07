from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from api.schemas import (
    HealthResponse,
    HoleListItem,
    PlayerListItem,
    RecommendationRequest,
    RecommendationResponse,
    ScenarioListItem,
    StrategySummary,
)
from api.service import compute_recommendation, get_hole, get_player, load_hole_catalog, load_players, load_scenarios


app = FastAPI(title="Sports Strategy Engine API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _strategy_summary(result) -> StrategySummary:
    return StrategySummary(
        club=result.option.club,
        aim_label=result.option.aim_label,
        aim_point={"x": result.option.aim_x, "y": result.option.aim_y},
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


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")


@app.get("/players", response_model=list[PlayerListItem])
def players() -> list[PlayerListItem]:
    return [
        PlayerListItem(
            player_name=player.player_name,
            handicap=player.handicap,
            handedness=player.handedness,
            preferred_shape=player.preferred_shape,
            miss_tendency=player.miss_tendency,
            risk_tolerance=player.risk_tolerance,
            club_count=len(player.clubs),
        )
        for player in load_players().values()
    ]


@app.get("/holes", response_model=list[HoleListItem])
def holes() -> list[HoleListItem]:
    return [
        HoleListItem(
            hole_id=hole.hole_id,
            name=hole.name,
            par=hole.par,
            yardage=hole.yardage,
            wind_speed_mph=hole.wind.speed_mph,
            wind_direction_deg=hole.wind.direction_deg,
        )
        for hole in load_hole_catalog().values()
    ]


@app.get("/scenarios", response_model=list[ScenarioListItem])
def scenarios() -> list[ScenarioListItem]:
    return [ScenarioListItem(**scenario) for scenario in load_scenarios()]


@app.post("/recommendation", response_model=RecommendationResponse)
def recommendation(payload: RecommendationRequest) -> RecommendationResponse:
    if payload.risk_tolerance_override not in {None, "low", "medium", "high"}:
        raise HTTPException(status_code=422, detail="risk_tolerance_override must be low, medium, or high")

    try:
        get_player(payload.player_name)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    try:
        get_hole(payload.hole_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    result = compute_recommendation(
        player_name=payload.player_name,
        hole_id=payload.hole_id,
        iterations=payload.iterations,
        risk_tolerance_override=payload.risk_tolerance_override,
    )

    return RecommendationResponse(
        player_name=payload.player_name,
        hole_id=payload.hole_id,
        recommendation=_strategy_summary(result.best),
        explanation=result.explanation,
        top_alternatives=[_strategy_summary(item) for item in result.ranked_strategies[1:4]],
    )
