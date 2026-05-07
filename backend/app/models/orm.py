from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database.database import Base


class PlayerORM(Base):
    __tablename__ = "players"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    player_name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    handicap: Mapped[float] = mapped_column(Float)
    handedness: Mapped[str] = mapped_column(String(16))
    preferred_shape: Mapped[str] = mapped_column(String(32))
    miss_tendency: Mapped[str] = mapped_column(String(32))
    risk_tolerance: Mapped[str] = mapped_column(String(16))

    clubs: Mapped[list["ClubORM"]] = relationship(
        back_populates="player",
        cascade="all, delete-orphan",
        order_by="ClubORM.id",
    )
    recommendations: Mapped[list["RecommendationORM"]] = relationship(back_populates="player")


class ClubORM(Base):
    __tablename__ = "clubs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"), index=True)
    club: Mapped[str] = mapped_column(String(64))
    carry_yards: Mapped[float] = mapped_column(Float)
    total_yards: Mapped[float] = mapped_column(Float)
    lateral_sigma: Mapped[float] = mapped_column(Float)
    distance_sigma: Mapped[float] = mapped_column(Float)
    confidence: Mapped[float] = mapped_column(Float)
    shape_bias: Mapped[float] = mapped_column(Float, default=0.0)
    lie_adjustment_sensitivity: Mapped[float] = mapped_column(Float, default=0.08)

    player: Mapped[PlayerORM] = relationship(back_populates="clubs")


class HoleORM(Base):
    __tablename__ = "holes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    external_hole_id: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    par: Mapped[int] = mapped_column(Integer)
    yardage: Mapped[float] = mapped_column(Float)
    tee_x: Mapped[float] = mapped_column(Float)
    tee_y: Mapped[float] = mapped_column(Float)
    green_center_x: Mapped[float] = mapped_column(Float)
    green_center_y: Mapped[float] = mapped_column(Float)
    green_radius: Mapped[float] = mapped_column(Float)
    fairway_center_x: Mapped[float] = mapped_column(Float)
    fairway_width: Mapped[float] = mapped_column(Float)
    fairway_start_y: Mapped[float] = mapped_column(Float)
    fairway_end_y: Mapped[float] = mapped_column(Float)
    rough_width: Mapped[float] = mapped_column(Float)
    hazards_json: Mapped[str] = mapped_column(Text)
    wind_speed_mph: Mapped[float] = mapped_column(Float)
    wind_direction_deg: Mapped[float] = mapped_column(Float)

    recommendations: Mapped[list["RecommendationORM"]] = relationship(back_populates="hole")


class RecommendationORM(Base):
    __tablename__ = "recommendations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"), index=True)
    hole_id: Mapped[int] = mapped_column(ForeignKey("holes.id"), index=True)
    iterations: Mapped[int] = mapped_column(Integer)
    risk_tolerance_used: Mapped[str] = mapped_column(String(16))
    explanation: Mapped[str] = mapped_column(Text)
    expected_strokes: Mapped[float] = mapped_column(Float)
    risk_adjusted_score: Mapped[float] = mapped_column(Float)
    variance: Mapped[float] = mapped_column(Float)
    penalty_probability: Mapped[float] = mapped_column(Float)
    best_strategy_json: Mapped[str] = mapped_column(Text)
    top_alternatives_json: Mapped[str] = mapped_column(Text)
    probabilities_json: Mapped[str] = mapped_column(Text)
    shot_cloud_summary_json: Mapped[str] = mapped_column(Text)
    duration_ms: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    player: Mapped[PlayerORM] = relationship(back_populates="recommendations")
    hole: Mapped[HoleORM] = relationship(back_populates="recommendations")
