import type { AimPoint, HazardData, HazardKind, HoleLayoutShape, HolePayload } from "../types";

export interface HoleSetupValues {
  hole_id: string;
  name: string;
  par: 3 | 4 | 5;
  yardage: number;
  shape: HoleLayoutShape;
}

export const HOLE_LAYOUT_OPTIONS: Array<{ value: HoleLayoutShape; label: string }> = [
  { value: "straight", label: "Straight" },
  { value: "slight_dogleg_right", label: "Slight dogleg right" },
  { value: "slight_dogleg_left", label: "Slight dogleg left" },
  { value: "hard_dogleg_right", label: "Hard dogleg right" },
  { value: "hard_dogleg_left", label: "Hard dogleg left" },
  { value: "s_curve", label: "S-curve" },
  { value: "short_par3", label: "Short par 3" },
  { value: "risk_reward_par5", label: "Risk/reward par 5" },
];

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

function point(x: number, y: number): AimPoint {
  return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function shortPar3Path(yardage: number): AimPoint[] {
  const startY = Math.max(20, yardage - 62);
  return [
    point(0, startY),
    point(4, yardage - 28),
  ];
}

function shapePath(shape: HoleLayoutShape, par: number, yardage: number): AimPoint[] {
  if (shape === "short_par3" || par === 3) {
    return shortPar3Path(yardage);
  }

  const startY = 42;
  const endY = Math.max(startY + 100, yardage - 34);
  const midY = yardage * 0.48;
  const lateY = yardage * 0.7;

  switch (shape) {
    case "slight_dogleg_right":
      return [point(0, startY), point(9, midY), point(15, endY)];
    case "slight_dogleg_left":
      return [point(0, startY), point(-9, midY), point(-15, endY)];
    case "hard_dogleg_right":
      return [point(0, startY), point(8, yardage * 0.33), point(26, midY), point(32, endY)];
    case "hard_dogleg_left":
      return [point(0, startY), point(-8, yardage * 0.33), point(-26, midY), point(-32, endY)];
    case "s_curve":
      return [point(0, startY), point(-14, yardage * 0.28), point(16, lateY), point(6, endY)];
    case "risk_reward_par5":
      return [point(0, startY), point(-10, yardage * 0.26), point(12, yardage * 0.58), point(20, endY)];
    case "straight":
    default:
      return [point(0, startY), point(0, midY), point(4, endY)];
  }
}

function fairwayStyleForShape(shape: HoleLayoutShape, par: number) {
  if (shape === "short_par3" || par === 3) {
    return { width: 24, rough: 14 };
  }
  if (shape === "risk_reward_par5") {
    return { width: 40, rough: 20 };
  }
  if (shape === "hard_dogleg_left" || shape === "hard_dogleg_right") {
    return { width: 34, rough: 18 };
  }
  return { width: par === 5 ? 38 : 34, rough: 18 };
}

export function createHazard(kind: HazardKind, pointHint?: AimPoint): HazardData {
  const center = pointHint ?? { x: 0, y: 220 };
  if (kind === "water") {
    return {
      kind,
      shape: "rectangle",
      center_x: center.x,
      center_y: center.y,
      width: 30,
      depth: 44,
      penalty_strokes: 1,
    };
  }
  if (kind === "ob") {
    return {
      kind,
      shape: "corridor",
      center_x: center.x,
      center_y: center.y,
      width: 16,
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
    radius: kind === "recovery" ? 14 : 11,
    penalty_strokes: 0,
  };
}

export function normalizeHazardDraft(hazard: HazardData): HazardData {
  const base: HazardData = {
    ...hazard,
    center_x: Number((hazard.center_x ?? 0).toFixed(1)),
    center_y: Number((hazard.center_y ?? 0).toFixed(1)),
    penalty_strokes: Number.isFinite(hazard.penalty_strokes) ? hazard.penalty_strokes : 0,
  };

  if (base.shape === "circle") {
    return {
      ...base,
      radius: Number(Math.max(6, base.radius ?? 12).toFixed(1)),
      width: null,
      depth: null,
      start_y: null,
      end_y: null,
    };
  }

  if (base.shape === "corridor") {
    const startY = base.start_y ?? base.center_y - 40;
    const endY = base.end_y ?? base.center_y + 40;
    const safeStart = Math.min(startY, endY - 12);
    const safeEnd = Math.max(endY, safeStart + 12);
    return {
      ...base,
      width: Number(Math.max(8, base.width ?? 16).toFixed(1)),
      start_y: Number(safeStart.toFixed(1)),
      end_y: Number(safeEnd.toFixed(1)),
      center_y: Number((((safeStart + safeEnd) / 2)).toFixed(1)),
      radius: null,
      depth: null,
    };
  }

  return {
    ...base,
    width: Number(Math.max(8, base.width ?? 28).toFixed(1)),
    depth: Number(Math.max(8, base.depth ?? 28).toFixed(1)),
    radius: null,
    start_y: null,
    end_y: null,
  };
}

function hazardSetForShape(shape: HoleLayoutShape, par: number, yardage: number, fairwayPath: AimPoint[]): HazardData[] {
  const end = fairwayPath[fairwayPath.length - 1] ?? point(0, yardage - 24);
  const mid = fairwayPath[Math.floor(fairwayPath.length / 2)] ?? point(0, yardage * 0.5);
  const early = fairwayPath[Math.max(0, Math.floor(fairwayPath.length / 3))] ?? point(0, yardage * 0.28);

  if (par === 3 || shape === "short_par3") {
    return [
      {
        kind: "bunker",
        shape: "circle",
        center_x: end.x - 16,
        center_y: yardage - 20,
        radius: 10,
        penalty_strokes: 0,
      },
      {
        kind: "bunker",
        shape: "circle",
        center_x: end.x + 17,
        center_y: yardage - 11,
        radius: 8,
        penalty_strokes: 0,
      },
      {
        kind: "water",
        shape: "rectangle",
        center_x: end.x + 26,
        center_y: yardage - 42,
        width: 26,
        depth: 34,
        penalty_strokes: 1,
      },
    ];
  }

  const hazards: HazardData[] = [
    {
      kind: "bunker",
      shape: "circle",
      center_x: end.x + (shape.includes("left") ? -14 : 14),
      center_y: yardage - 22,
      radius: 11,
      penalty_strokes: 0,
    },
    {
      kind: "ob",
      shape: "corridor",
      center_x: shape.includes("left") ? -52 : 52,
      center_y: yardage / 2,
      width: 14,
      start_y: 0,
      end_y: yardage + 18,
      penalty_strokes: 1,
    },
  ];

  if (shape === "risk_reward_par5") {
    hazards.push(
      {
        kind: "water",
        shape: "rectangle",
        center_x: mid.x + 14,
        center_y: yardage * 0.58,
        width: 36,
        depth: 58,
        penalty_strokes: 1,
      },
      {
        kind: "bunker",
        shape: "circle",
        center_x: early.x - 18,
        center_y: yardage * 0.32,
        radius: 10,
        penalty_strokes: 0,
      },
    );
    return hazards;
  }

  if (shape === "s_curve") {
    hazards.push(
      {
        kind: "water",
        shape: "rectangle",
        center_x: early.x + 20,
        center_y: yardage * 0.34,
        width: 24,
        depth: 46,
        penalty_strokes: 1,
      },
      {
        kind: "bunker",
        shape: "circle",
        center_x: mid.x - 16,
        center_y: yardage * 0.63,
        radius: 9,
        penalty_strokes: 0,
      },
    );
    return hazards;
  }

  if (shape.includes("dogleg")) {
    hazards.push({
      kind: "water",
      shape: "rectangle",
      center_x: mid.x + (shape.includes("left") ? 20 : -20),
      center_y: yardage * 0.46,
      width: shape.includes("hard") ? 24 : 18,
      depth: shape.includes("hard") ? 56 : 42,
      penalty_strokes: 1,
    });
    return hazards;
  }

  if (par >= 4) {
    hazards.push({
      kind: "water",
      shape: "rectangle",
      center_x: early.x - 22,
      center_y: yardage * 0.52,
      width: 24,
      depth: 44,
      penalty_strokes: 1,
    });
  }

  return hazards;
}

export function createGeneratedHoleDraft(setup: HoleSetupValues): HolePayload {
  const effectiveShape = setup.par === 3 && setup.shape !== "short_par3" ? "short_par3" : setup.shape;
  const fairwayPath = shapePath(effectiveShape, setup.par, setup.yardage);
  const fairwayStart = fairwayPath[0]?.y ?? 40;
  const fairwayEnd = fairwayPath[fairwayPath.length - 1]?.y ?? Math.max(70, setup.yardage - 30);
  const fairwayCenterX = fairwayPath[Math.floor(fairwayPath.length / 2)]?.x ?? 0;
  const fairwayStyle = fairwayStyleForShape(effectiveShape, setup.par);
  const greenCenter = point(
    fairwayPath[fairwayPath.length - 1]?.x ?? 0,
    setup.yardage,
  );
  const pinPosition = point(greenCenter.x + (effectiveShape.includes("right") ? 3 : 1), setup.yardage + (setup.par === 3 ? -1 : 1));

  return {
    hole_id: setup.hole_id || suggestHoleId(setup.name, setup.par, setup.yardage),
    name: setup.name || `Custom Par ${setup.par}`,
    par: setup.par,
    yardage: setup.yardage,
    tee: point(0, 0),
    green_center: greenCenter,
    green_radius: setup.par === 3 ? 16 : setup.par === 5 ? 20 : 18,
    pin_position: pinPosition,
    fairway_center_x: fairwayCenterX,
    fairway_width: fairwayStyle.width,
    fairway_start_y: fairwayStart,
    fairway_end_y: fairwayEnd,
    rough_width: fairwayStyle.rough,
    fairway_path: fairwayPath,
    hazards: hazardSetForShape(effectiveShape, setup.par, setup.yardage, fairwayPath),
    wind: { speed_mph: 8, direction_deg: 45 },
  };
}

export function normalizeHole<T extends HolePayload>(hole: T): T {
  const pinPosition = hole.pin_position ?? hole.green_center;
  const normalizedFairwayPath =
    hole.fairway_path && hole.fairway_path.length >= 2
      ? hole.fairway_path
      : shapePath("straight", hole.par as 3 | 4 | 5, hole.yardage).map((_point, index, path) => {
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
    fairway_path: normalizedFairwayPath,
    hazards: hole.hazards.map(normalizeHazardDraft),
  } as T;
}

export function syncLegacyFairwayFields(hole: HolePayload, fairwayPath: AimPoint[]): HolePayload {
  const sortedPath = [...fairwayPath].sort((left, right) => left.y - right.y);
  const mid = sortedPath[Math.floor(sortedPath.length / 2)] ?? { x: hole.fairway_center_x, y: hole.fairway_start_y };
  return {
    ...hole,
    fairway_center_x: Number(mid.x.toFixed(1)),
    fairway_start_y: Number((sortedPath[0]?.y ?? hole.fairway_start_y).toFixed(1)),
    fairway_end_y: Number((sortedPath[sortedPath.length - 1]?.y ?? hole.fairway_end_y).toFixed(1)),
    fairway_path: sortedPath.map((currentPoint, index) => ({
      x: Number(currentPoint.x.toFixed(1)),
      y: Number(
        clamp(
          currentPoint.y,
          index === 0 ? 8 : sortedPath[index - 1].y + 20,
          index === sortedPath.length - 1 ? hole.yardage : sortedPath[index + 1].y - 20,
        ).toFixed(1),
      ),
    })),
  };
}
