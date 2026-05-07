from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import json
from typing import Any

import numpy as np


RISK_MAP = {"low": 1.35, "medium": 1.0, "high": 0.7}
VALID_SHOT_SHAPES = {"straight", "draw", "fade"}
VALID_RISK_TOLERANCES = set(RISK_MAP)
VALID_HANDEDNESS = {"right", "left"}
VALID_MISS_TENDENCIES = {"center", "none", "left", "right", "pull", "push"}


@dataclass(frozen=True)
class Club:
    club: str
    carry_yards: float
    total_yards: float
    lateral_sigma: float
    distance_sigma: float
    confidence: float
    shape_bias: float = 0.0
    lie_adjustment_sensitivity: float = 0.08

    def __post_init__(self) -> None:
        if self.carry_yards <= 0 or self.total_yards <= 0:
            raise ValueError(f"Club '{self.club}' must have positive carry and total yards.")
        if self.total_yards < self.carry_yards:
            raise ValueError(f"Club '{self.club}' total_yards cannot be less than carry_yards.")
        if self.lateral_sigma < 0 or self.distance_sigma < 0:
            raise ValueError(f"Club '{self.club}' dispersion values cannot be negative.")
        if not 0.0 <= self.confidence <= 1.0:
            raise ValueError(f"Club '{self.club}' confidence must be within [0, 1].")
        if self.lie_adjustment_sensitivity < 0:
            raise ValueError(f"Club '{self.club}' lie_adjustment_sensitivity cannot be negative.")


@dataclass(frozen=True)
class PlayerProfile:
    player_name: str
    handicap: float
    handedness: str
    preferred_shape: str
    miss_tendency: str
    risk_tolerance: str
    clubs: list[Club]

    def __post_init__(self) -> None:
        if self.handedness.lower() not in VALID_HANDEDNESS:
            raise ValueError(f"Unsupported handedness: {self.handedness}")
        if self.preferred_shape not in VALID_SHOT_SHAPES:
            raise ValueError(f"Unsupported preferred_shape: {self.preferred_shape}")
        if self.miss_tendency.lower() not in VALID_MISS_TENDENCIES:
            raise ValueError(f"Unsupported miss_tendency: {self.miss_tendency}")
        if self.risk_tolerance not in VALID_RISK_TOLERANCES:
            raise ValueError(f"Unsupported risk_tolerance: {self.risk_tolerance}")
        if not self.clubs:
            raise ValueError("PlayerProfile must include at least one club.")

    def club_by_name(self, club_name: str) -> Club:
        for club in self.clubs:
            if club.club == club_name:
                return club
        raise KeyError(f"Unknown club: {club_name}")

    def risk_multiplier(self) -> float:
        return RISK_MAP.get(self.risk_tolerance, 1.0)


@dataclass(frozen=True)
class ShotOption:
    club: str
    aim_x: float
    aim_y: float
    aim_label: str
    shot_shape: str
    swing_intensity: float

    def __post_init__(self) -> None:
        if self.shot_shape not in VALID_SHOT_SHAPES:
            raise ValueError(f"Unsupported shot_shape: {self.shot_shape}")
        if not 0.0 < self.swing_intensity <= 1.0:
            raise ValueError("swing_intensity must be within (0, 1].")


@dataclass(frozen=True)
class ShotDistribution:
    mean_x: float
    mean_y: float
    sigma_x: float
    sigma_y: float
    covariance_xy: float
    expected_total_yards: float


def _shape_direction(shape: str, handedness: str) -> float:
    if shape == "straight":
        return 0.0
    sign = -1.0 if shape == "draw" else 1.0
    return sign if handedness.lower() == "right" else -sign


def _miss_direction(miss_tendency: str, handedness: str) -> float:
    tendency = miss_tendency.lower()
    if tendency in {"center", "none"}:
        return 0.0
    if tendency in {"left", "pull"}:
        return -1.0 if handedness.lower() == "right" else 1.0
    if tendency in {"right", "push"}:
        return 1.0 if handedness.lower() == "right" else -1.0
    return 0.0


def _lie_multiplier(lie: str) -> tuple[float, float]:
    table = {
        "tee": (1.0, 1.0),
        "fairway": (1.0, 1.0),
        "rough": (0.94, 1.18),
        "bunker": (0.82, 1.35),
        "recovery": (0.78, 1.45),
        "green": (0.15, 0.3),
    }
    return table.get(lie, (1.0, 1.0))


def build_shot_distribution(
    player: PlayerProfile,
    club: Club,
    option: ShotOption,
    lie: str,
    wind_speed_mph: float,
    wind_direction_deg: float,
) -> ShotDistribution:
    if wind_speed_mph < 0:
        raise ValueError("wind_speed_mph cannot be negative.")

    lie_distance_factor, lie_dispersion_factor = _lie_multiplier(lie)
    intensity = option.swing_intensity
    confidence_factor = 1.0 + (1.0 - club.confidence) * 0.45

    base_carry = club.carry_yards * (0.55 + 0.45 * intensity) * lie_distance_factor
    base_total = club.total_yards * (0.55 + 0.45 * intensity) * lie_distance_factor
    sigma_y = club.distance_sigma * (0.78 + 0.34 * intensity) * confidence_factor * lie_dispersion_factor
    sigma_x = club.lateral_sigma * (0.72 + 0.42 * intensity) * confidence_factor * lie_dispersion_factor

    wind_radians = np.deg2rad(wind_direction_deg)
    head_tail_component = -np.cos(wind_radians)
    cross_component = np.sin(wind_radians)

    carry_adjustment = wind_speed_mph * 0.45 * head_tail_component
    crosswind_adjustment = wind_speed_mph * 0.65 * cross_component

    shape_direction = _shape_direction(option.shot_shape, player.handedness)
    miss_direction = _miss_direction(player.miss_tendency, player.handedness)

    shape_bias = shape_direction * (club.lateral_sigma * 0.45 + club.shape_bias)
    miss_bias = miss_direction * club.lateral_sigma * 0.22
    preference_bonus = 0.85 if option.shot_shape == player.preferred_shape else 1.0

    sigma_x *= preference_bonus
    sigma_y *= 0.92 if option.shot_shape == player.preferred_shape else 1.0

    correlation = float(np.clip(shape_direction * 0.08, -0.95, 0.95))
    covariance = correlation * sigma_x * sigma_y

    return ShotDistribution(
        mean_x=option.aim_x + shape_bias + miss_bias + crosswind_adjustment,
        mean_y=option.aim_y + (base_carry - club.carry_yards) + carry_adjustment,
        sigma_x=sigma_x,
        sigma_y=sigma_y,
        covariance_xy=covariance,
        expected_total_yards=base_total + carry_adjustment,
    )


def load_player_profiles(path: str | Path) -> dict[str, PlayerProfile]:
    try:
        raw_profiles = json.loads(Path(path).read_text())
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid player profile JSON in {path}: {exc}") from exc
    profiles: dict[str, PlayerProfile] = {}
    for item in raw_profiles:
        clubs = [Club(**club_data) for club_data in item["clubs"]]
        profile = PlayerProfile(
            player_name=item["player_name"],
            handicap=item["handicap"],
            handedness=item.get("handedness", "right"),
            preferred_shape=item["preferred_shape"],
            miss_tendency=item["miss_tendency"],
            risk_tolerance=item["risk_tolerance"],
            clubs=clubs,
        )
        profiles[profile.player_name] = profile
    return profiles


def player_to_dict(player: PlayerProfile) -> dict[str, Any]:
    return {
        "player_name": player.player_name,
        "handicap": player.handicap,
        "handedness": player.handedness,
        "preferred_shape": player.preferred_shape,
        "miss_tendency": player.miss_tendency,
        "risk_tolerance": player.risk_tolerance,
        "clubs": [club.__dict__ for club in player.clubs],
    }
