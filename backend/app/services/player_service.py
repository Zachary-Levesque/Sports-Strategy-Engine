from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from backend.app.core.exceptions import NotFoundError
from backend.app.models.orm import ClubORM, PlayerORM, ScenarioORM
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


def update_player(db: Session, player_name: str, payload: PlayerCreate) -> PlayerORM:
    player = get_player_by_name(db, player_name)
    old_name = player.player_name
    if payload.player_name != player_name:
        existing = db.scalar(select(PlayerORM).where(PlayerORM.player_name == payload.player_name))
        if existing is not None:
            raise ValueError(f"Player '{payload.player_name}' already exists.")

    player.player_name = payload.player_name
    player.handicap = payload.handicap
    player.handedness = payload.handedness
    player.preferred_shape = payload.preferred_shape
    player.miss_tendency = payload.miss_tendency
    player.risk_tolerance = payload.risk_tolerance
    if payload.player_name != old_name:
        scenarios = list(db.scalars(select(ScenarioORM).where(ScenarioORM.player_name == old_name)))
        for scenario in scenarios:
            scenario.player_name = payload.player_name
    player.clubs.clear()
    player.clubs.extend(
        [
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
    )
    db.commit()
    db.refresh(player)
    return get_player_by_id(db, player.id)


def delete_player(db: Session, player_name: str) -> None:
    player = get_player_by_name(db, player_name)
    scenarios = list(db.scalars(select(ScenarioORM).where(ScenarioORM.player_name == player_name)))
    for scenario in scenarios:
        db.delete(scenario)
    db.delete(player)
    db.commit()


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
