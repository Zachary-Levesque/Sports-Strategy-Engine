from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from backend.app.core.exceptions import NotFoundError
from backend.app.models.orm import ClubORM, PlayerORM
from backend.app.schemas.player import PlayerCreate
from backend.app.simulation.player_model import Club, PlayerProfile


def list_players(db: Session) -> list[PlayerORM]:
    statement = select(PlayerORM).options(selectinload(PlayerORM.clubs)).order_by(PlayerORM.player_name)
    return list(db.scalars(statement))


def get_player_by_id(db: Session, player_id: int) -> PlayerORM:
    statement = select(PlayerORM).options(selectinload(PlayerORM.clubs)).where(PlayerORM.id == player_id)
    player = db.scalars(statement).first()
    if player is None:
        raise NotFoundError(f"Player {player_id} was not found.")
    return player


def get_player_by_name(db: Session, player_name: str) -> PlayerORM:
    statement = select(PlayerORM).options(selectinload(PlayerORM.clubs)).where(PlayerORM.player_name == player_name)
    player = db.scalars(statement).first()
    if player is None:
        raise NotFoundError(f"Player '{player_name}' was not found.")
    return player


def create_player(db: Session, payload: PlayerCreate) -> PlayerORM:
    existing = db.scalar(select(PlayerORM).where(PlayerORM.player_name == payload.player_name))
    if existing is not None:
        raise ValueError(f"Player '{payload.player_name}' already exists.")

    player = PlayerORM(
        player_name=payload.player_name,
        handicap=payload.handicap,
        handedness=payload.handedness,
        preferred_shape=payload.preferred_shape,
        miss_tendency=payload.miss_tendency,
        risk_tolerance=payload.risk_tolerance,
    )
    player.clubs = [
        ClubORM(
            club=club.club,
            carry_yards=club.carry_yards,
            total_yards=club.total_yards,
            lateral_sigma=club.lateral_sigma,
            distance_sigma=club.distance_sigma,
            confidence=club.confidence,
            shape_bias=club.shape_bias,
            lie_adjustment_sensitivity=club.lie_adjustment_sensitivity,
        )
        for club in payload.clubs
    ]
    db.add(player)
    db.commit()
    db.refresh(player)
    return get_player_by_id(db, player.id)


def to_domain(player: PlayerORM, risk_tolerance_override: str | None = None) -> PlayerProfile:
    clubs = [
        Club(
            club=club.club,
            carry_yards=club.carry_yards,
            total_yards=club.total_yards,
            lateral_sigma=club.lateral_sigma,
            distance_sigma=club.distance_sigma,
            confidence=club.confidence,
            shape_bias=club.shape_bias,
            lie_adjustment_sensitivity=club.lie_adjustment_sensitivity,
        )
        for club in player.clubs
    ]
    return PlayerProfile(
        player_name=player.player_name,
        handicap=player.handicap,
        handedness=player.handedness,
        preferred_shape=player.preferred_shape,
        miss_tendency=player.miss_tendency,
        risk_tolerance=risk_tolerance_override or player.risk_tolerance,
        clubs=clubs,
    )
