from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database.database import get_db
from backend.app.schemas.player import PlayerCreate, PlayerDetail, PlayerSummary
from backend.app.services.player_service import (
    create_player,
    delete_player,
    get_player_by_name,
    list_players,
    update_player,
)


router = APIRouter(tags=["players"])


@router.get("/players", response_model=list[PlayerSummary])
def get_players(db: Session = Depends(get_db)) -> list[PlayerSummary]:
    players = list_players(db)
    return [
        PlayerSummary(
            id=player.id,
            player_name=player.player_name,
            handicap=player.handicap,
            handedness=player.handedness,
            preferred_shape=player.preferred_shape,
            miss_tendency=player.miss_tendency,
            risk_tolerance=player.risk_tolerance,
            club_count=len(player.clubs),
        )
        for player in players
    ]


@router.get("/players/{player_name}", response_model=PlayerDetail)
def get_player(player_name: str, db: Session = Depends(get_db)) -> PlayerDetail:
    player = get_player_by_name(db, player_name)
    return PlayerDetail.model_validate(player)


@router.post("/players", response_model=PlayerDetail, status_code=status.HTTP_201_CREATED)
def post_player(payload: PlayerCreate, db: Session = Depends(get_db)) -> PlayerDetail:
    try:
        player = create_player(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return PlayerDetail.model_validate(player)


@router.put("/players/{player_name}", response_model=PlayerDetail)
def put_player(player_name: str, payload: PlayerCreate, db: Session = Depends(get_db)) -> PlayerDetail:
    try:
        player = update_player(db, player_name, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return PlayerDetail.model_validate(player)


@router.delete("/players/{player_name}", status_code=status.HTTP_204_NO_CONTENT)
def remove_player(player_name: str, db: Session = Depends(get_db)) -> None:
    delete_player(db, player_name)
