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
    fairway_center_x: float
    fairway_width: float
    fairway_start_y: float
    fairway_end_y: float
    rough_width: float
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
        fairway_center_x=item["fairway_center_x"],
        fairway_width=item["fairway_width"],
        fairway_start_y=item["fairway_start_y"],
        fairway_end_y=item["fairway_end_y"],
        rough_width=item["rough_width"],
        hazards=[_zone_from_dict(zone) for zone in item.get("hazards", [])],
        wind=Wind(**item["wind"]),
    )


def load_holes(path: str | Path) -> dict[str, Hole]:
    raw_holes = json.loads(Path(path).read_text())
    holes = [hole_from_dict(item) for item in raw_holes]
    return {hole.hole_id: hole for hole in holes}


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

    if in_fairway_band and abs(x - hole.fairway_center_x) <= fairway_half_width:
        return "fairway"
    if in_fairway_band and abs(x - hole.fairway_center_x) <= rough_half_width:
        return "rough"
    return "recovery"


def generate_hole(par: int, seed: int | None = None) -> Hole:
    rng = random.Random(seed)
    yardage_ranges = {3: (145, 225), 4: (345, 465), 5: (495, 585)}
    yardage = float(rng.randint(*yardage_ranges[par]))
    fairway_width = float(rng.randint(28, 42))
    rough_width = float(rng.randint(16, 26))
    fairway_end = yardage - rng.randint(18, 32)

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
        fairway_center_x=0.0,
        fairway_width=fairway_width,
        fairway_start_y=40.0 if par > 3 else yardage - 32.0,
        fairway_end_y=fairway_end,
        rough_width=rough_width,
        hazards=hazards,
        wind=Wind(speed_mph=float(rng.randint(4, 16)), direction_deg=float(rng.randint(0, 359))),
    )


def save_generated_holes(path: str | Path, holes: list[Hole]) -> None:
    serializable = [hole_to_dict(hole) for hole in holes]
    Path(path).write_text(json.dumps(serializable, indent=2))


def hole_to_dict(hole: Hole) -> dict[str, Any]:
    return {
        "hole_id": hole.hole_id,
        "name": hole.name,
        "par": hole.par,
        "yardage": hole.yardage,
        "tee": hole.tee.__dict__,
        "green_center": hole.green_center.__dict__,
        "green_radius": hole.green_radius,
        "fairway_center_x": hole.fairway_center_x,
        "fairway_width": hole.fairway_width,
        "fairway_start_y": hole.fairway_start_y,
        "fairway_end_y": hole.fairway_end_y,
        "rough_width": hole.rough_width,
        "hazards": [hazard.__dict__ for hazard in hole.hazards],
        "wind": hole.wind.__dict__,
    }
