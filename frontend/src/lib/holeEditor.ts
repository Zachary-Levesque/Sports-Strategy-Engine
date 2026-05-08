import type { AimPoint, HazardData, HazardKind, HolePayload } from "../types";

export interface HoleSetupValues {
  hole_id: string;
  name: string;
  par: 3 | 4 | 5;
  yardage: number;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function suggestHoleId(name: string, par: number, yardage: number): string {
  const base = slugify(name);
  if (base) {
    return base;
  }
  return `custom_par${par}_${Math.round(yardage)}`;
}

export function defaultFairwayPath(par: number, yardage: number): AimPoint[] {
  if (par === 3) {
    return [
      { x: 0, y: Math.max(18, yardage - 40) },
      { x: 4, y: Math.max(28, yardage - 18) },
    ];
  }

  const startY = 40;
  const endY = Math.max(startY + 80, yardage - 28);
  return [
    { x: 0, y: startY },
    { x: par === 5 ? -14 : -10, y: Math.round(yardage * 0.45) },
    { x: par === 5 ? 10 : 6, y: endY },
  ];
}

export function createHazard(kind: HazardKind, point?: AimPoint): HazardData {
  const center = point ?? { x: 0, y: 220 };
  if (kind === "water") {
    return {
      kind,
      shape: "rectangle",
      center_x: center.x,
      center_y: center.y,
      width: 24,
      depth: 42,
      penalty_strokes: 1,
    };
  }
  if (kind === "ob") {
    return {
      kind,
      shape: "corridor",
      center_x: center.x,
      center_y: center.y,
      width: 18,
      start_y: Math.max(0, center.y - 90),
      end_y: center.y + 90,
      penalty_strokes: 1,
    };
  }
  return {
    kind,
    shape: "circle",
    center_x: center.x,
    center_y: center.y,
    radius: kind === "recovery" ? 12 : 10,
    penalty_strokes: 0,
  };
}

export function createGeneratedHoleDraft(setup: HoleSetupValues): HolePayload {
  const fairwayPath = defaultFairwayPath(setup.par, setup.yardage);
  const fairwayStart = fairwayPath[0]?.y ?? 40;
  const fairwayEnd = fairwayPath[fairwayPath.length - 1]?.y ?? Math.max(70, setup.yardage - 30);
  const fairwayCenterX = fairwayPath[Math.floor(fairwayPath.length / 2)]?.x ?? 0;
  const greenCenter = { x: 0, y: setup.yardage };
  const pinPosition = { x: 2, y: setup.yardage + (setup.par === 3 ? -1 : 1) };
  const hazards: HazardData[] = [
    createHazard("bunker", { x: 12, y: setup.yardage - 18 }),
    createHazard("ob", { x: setup.par === 5 ? 46 : 42, y: setup.yardage / 2 }),
  ];
  if (setup.par >= 4) {
    hazards.push(createHazard("water", { x: -24, y: setup.yardage * 0.58 }));
  }

  return {
    hole_id: setup.hole_id || suggestHoleId(setup.name, setup.par, setup.yardage),
    name: setup.name || `Custom Par ${setup.par}`,
    par: setup.par,
    yardage: setup.yardage,
    tee: { x: 0, y: 0 },
    green_center: greenCenter,
    green_radius: setup.par === 3 ? 16 : 18,
    pin_position: pinPosition,
    fairway_center_x: fairwayCenterX,
    fairway_width: setup.par === 5 ? 38 : 34,
    fairway_start_y: fairwayStart,
    fairway_end_y: fairwayEnd,
    rough_width: 18,
    fairway_path: fairwayPath,
    hazards,
    wind: { speed_mph: 8, direction_deg: 45 },
  };
}

export function normalizeHole(hole: HolePayload): HolePayload {
  const pinPosition = hole.pin_position ?? hole.green_center;
  const fairwayPath =
    hole.fairway_path && hole.fairway_path.length >= 2
      ? hole.fairway_path
      : defaultFairwayPath(hole.par, hole.yardage).map((point, index, path) => {
          if (path.length === 2) {
            return index === 0
              ? { x: hole.fairway_center_x, y: hole.fairway_start_y }
              : { x: hole.fairway_center_x, y: hole.fairway_end_y };
          }
          return index === 0
            ? { x: hole.fairway_center_x, y: hole.fairway_start_y }
            : index === path.length - 1
              ? { x: hole.fairway_center_x, y: hole.fairway_end_y }
              : { x: hole.fairway_center_x, y: (hole.fairway_start_y + hole.fairway_end_y) / 2 };
        });

  return {
    ...hole,
    pin_position: pinPosition,
    fairway_path,
  };
}

export function syncLegacyFairwayFields(hole: HolePayload, fairwayPath: AimPoint[]): HolePayload {
  const sortedPath = [...fairwayPath].sort((left, right) => left.y - right.y);
  const mid = sortedPath[Math.floor(sortedPath.length / 2)] ?? { x: hole.fairway_center_x, y: hole.fairway_start_y };
  return {
    ...hole,
    fairway_center_x: mid.x,
    fairway_start_y: sortedPath[0]?.y ?? hole.fairway_start_y,
    fairway_end_y: sortedPath[sortedPath.length - 1]?.y ?? hole.fairway_end_y,
    fairway_path: sortedPath,
  };
}
