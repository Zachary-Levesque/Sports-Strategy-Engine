from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import json
import random
from typing import Any


@dataclass(frozen=True)
class Point:
    x: float
    y: float


@dataclass(frozen=True)
class Zone:
    kind: str
    shape: str
    center_x: float
    center_y: float
    radius: float | None = None
    width: float | None = None
    depth: float | None = None
    start_y: float | None = None
    end_y: float | None = None
    x_min: float | None = None
    x_max: float | None = None
    y_min: float | None = None
    y_max: float | None = None
    penalty_strokes: float = 0.0


@dataclass(frozen=True)
class Wind:
    speed_mph: float
    direction_deg: float


@dataclass(frozen=True)
class Hole:
    hole_id: str
    name: str
    par: int
    yardage: float
    tee: Point
    green_center: Point
    green_radius: float
    pin_position: Point | None = None
    fairway_center_x: float
    fairway_width: float
    fairway_start_y: float
    fairway_end_y: float
    rough_width: float
    fairway_path: list[Point] | None = None
    hazards: list[Zone]
    wind: Wind


def _zone_from_dict(item: dict[str, Any]) -> Zone:
    return Zone(**item)


def _point_from_dict(item: dict[str, float]) -> Point:
    return Point(**item)


def hole_from_dict(item: dict[str, Any]) -> Hole:
    return Hole(
        hole_id=item["hole_id"],
        name=item["name"],
        par=item["par"],
        yardage=item["yardage"],
        tee=_point_from_dict(item["tee"]),
        green_center=_point_from_dict(item["green_center"]),
        green_radius=item["green_radius"],
        pin_position=_point_from_dict(item["pin_position"]) if item.get("pin_position") else None,
        fairway_center_x=item["fairway_center_x"],
        fairway_width=item["fairway_width"],
        fairway_start_y=item["fairway_start_y"],
        fairway_end_y=item["fairway_end_y"],
        rough_width=item["rough_width"],
        fairway_path=[_point_from_dict(point) for point in item.get("fairway_path", [])] or None,
        hazards=[_zone_from_dict(zone) for zone in item.get("hazards", [])],
        wind=Wind(**item["wind"]),
    )


def load_holes(path: str | Path) -> dict[str, Hole]:
    try:
        raw_holes = json.loads(Path(path).read_text())
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid hole JSON in {path}: {exc}") from exc
    holes = [hole_from_dict(item) for item in raw_holes]
    return {hole.hole_id: hole for hole in holes}


def fairway_center_x_at_y(hole: Hole, y: float) -> float:
    if not hole.fairway_path or len(hole.fairway_path) < 2:
        return hole.fairway_center_x

    path = sorted(hole.fairway_path, key=lambda point: point.y)
    if y <= path[0].y:
        return path[0].x
    if y >= path[-1].y:
        return path[-1].x

    for start, end in zip(path, path[1:]):
        if start.y <= y <= end.y:
            span = end.y - start.y
            if span == 0:
                return end.x
            t = (y - start.y) / span
            return start.x + (end.x - start.x) * t

    return hole.fairway_center_x


def zone_contains(zone: Zone, x: float, y: float) -> bool:
    if zone.shape == "circle" and zone.radius is not None:
        return (x - zone.center_x) ** 2 + (y - zone.center_y) ** 2 <= zone.radius**2
    if zone.shape == "rectangle":
        if zone.width is not None and zone.depth is not None:
            return (
                zone.center_x - zone.width / 2 <= x <= zone.center_x + zone.width / 2
                and zone.center_y - zone.depth / 2 <= y <= zone.center_y + zone.depth / 2
            )
        if None not in {zone.x_min, zone.x_max, zone.y_min, zone.y_max}:
            return zone.x_min <= x <= zone.x_max and zone.y_min <= y <= zone.y_max
    if zone.shape == "corridor" and None not in {zone.start_y, zone.end_y, zone.width}:
        return zone.start_y <= y <= zone.end_y and abs(x - zone.center_x) <= zone.width / 2
    return False


def classify_surface(hole: Hole, x: float, y: float) -> str:
    for hazard in hole.hazards:
        if zone_contains(hazard, x, y):
            return hazard.kind

    if (x - hole.green_center.x) ** 2 + (y - hole.green_center.y) ** 2 <= hole.green_radius**2:
        return "green"

    in_fairway_band = hole.fairway_start_y <= y <= hole.fairway_end_y
    fairway_half_width = hole.fairway_width / 2
    rough_half_width = fairway_half_width + hole.rough_width
    fairway_center_x = fairway_center_x_at_y(hole, y)

    if in_fairway_band and abs(x - fairway_center_x) <= fairway_half_width:
        return "fairway"
    if in_fairway_band and abs(x - fairway_center_x) <= rough_half_width:
        return "rough"
    return "recovery"


def generate_hole(par: int, seed: int | None = None, yardage: float | None = None) -> Hole:
    if par not in {3, 4, 5}:
        raise ValueError("generate_hole currently supports only par 3, 4, or 5 holes.")
    rng = random.Random(seed)
    yardage_ranges = {3: (145, 225), 4: (345, 465), 5: (495, 585)}
    yardage = float(yardage if yardage is not None else rng.randint(*yardage_ranges[par]))
    fairway_width = float(rng.randint(28, 42))
    rough_width = float(rng.randint(16, 26))
    fairway_end = yardage - rng.randint(18, 32)
    fairway_start = 40.0 if par > 3 else max(20.0, yardage - 32.0)
    fairway_mid_y = (fairway_start + fairway_end) / 2
    fairway_path = [
        Point(0.0, fairway_start),
        Point(float(rng.randint(-18, 18)) if par > 3 else float(rng.randint(-10, 10)), fairway_mid_y),
        Point(float(rng.randint(-12, 12)), fairway_end),
    ]

    hazards: list[Zone] = []
    if par >= 4:
        hazards.append(
            Zone(
                kind="water",
                shape="rectangle",
                center_x=rng.choice([-24.0, 24.0]),
                center_y=float(rng.randint(210, min(int(yardage - 70), 300))),
                width=float(rng.randint(18, 30)),
                depth=float(rng.randint(35, 55)),
                penalty_strokes=1.0,
            )
        )
    hazards.append(
        Zone(
            kind="bunker",
            shape="circle",
            center_x=float(rng.choice([-12, 12])),
            center_y=yardage - rng.randint(12, 28),
            radius=float(rng.randint(9, 14)),
            penalty_strokes=0.0,
        )
    )
    hazards.append(
        Zone(
            kind="ob",
            shape="corridor",
            center_x=float(rng.choice([-48, 48])),
            center_y=yardage / 2,
            width=18.0,
            start_y=0.0,
            end_y=yardage + 20.0,
            penalty_strokes=1.0,
        )
    )

    return Hole(
        hole_id=f"generated_par_{par}_{seed if seed is not None else 'random'}",
        name=f"Generated Par {par}",
        par=par,
        yardage=yardage,
        tee=Point(0.0, 0.0),
        green_center=Point(0.0, yardage),
        green_radius=16.0 if par == 3 else 18.0,
        pin_position=Point(0.0, yardage),
        fairway_center_x=0.0,
        fairway_width=fairway_width,
        fairway_start_y=fairway_start,
        fairway_end_y=fairway_end,
        rough_width=rough_width,
        fairway_path=fairway_path,
        hazards=hazards,
        wind=Wind(speed_mph=float(rng.randint(4, 16)), direction_deg=float(rng.randint(0, 359))),
    )


def hole_to_dict(hole: Hole) -> dict[str, Any]:
    return {
        "hole_id": hole.hole_id,
        "name": hole.name,
        "par": hole.par,
        "yardage": hole.yardage,
        "tee": hole.tee.__dict__,
        "green_center": hole.green_center.__dict__,
        "green_radius": hole.green_radius,
        "pin_position": hole.pin_position.__dict__ if hole.pin_position else None,
        "fairway_center_x": hole.fairway_center_x,
        "fairway_width": hole.fairway_width,
        "fairway_start_y": hole.fairway_start_y,
        "fairway_end_y": hole.fairway_end_y,
        "rough_width": hole.rough_width,
        "fairway_path": [point.__dict__ for point in hole.fairway_path] if hole.fairway_path else None,
        "hazards": [hazard.__dict__ for hazard in hole.hazards],
        "wind": hole.wind.__dict__,
    }
