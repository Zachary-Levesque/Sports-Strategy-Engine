import type { AimPoint, HazardData, HolePayload } from "../types";

export interface HoleMapProjection {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  toSvgX: (x: number) => number;
  toSvgY: (y: number) => number;
  toHolePoint: (svgX: number, svgY: number) => AimPoint;
}

function hazardBounds(hazard: HazardData): { xMin: number; xMax: number; yMin: number; yMax: number } {
  if (hazard.shape === "circle") {
    const radius = hazard.radius ?? 0;
    return {
      xMin: hazard.center_x - radius,
      xMax: hazard.center_x + radius,
      yMin: hazard.center_y - radius,
      yMax: hazard.center_y + radius,
    };
  }

  if (hazard.shape === "corridor") {
    const width = hazard.width ?? 0;
    return {
      xMin: hazard.center_x - width / 2,
      xMax: hazard.center_x + width / 2,
      yMin: hazard.start_y ?? hazard.center_y,
      yMax: hazard.end_y ?? hazard.center_y,
    };
  }

  const width = hazard.width ?? Math.max(0, (hazard.x_max ?? hazard.center_x) - (hazard.x_min ?? hazard.center_x));
  const depth = hazard.depth ?? Math.max(0, (hazard.y_max ?? hazard.center_y) - (hazard.y_min ?? hazard.center_y));
  return {
    xMin: hazard.x_min ?? hazard.center_x - width / 2,
    xMax: hazard.x_max ?? hazard.center_x + width / 2,
    yMin: hazard.y_min ?? hazard.center_y - depth / 2,
    yMax: hazard.y_max ?? hazard.center_y + depth / 2,
  };
}

export function getProjection(
  hole: HolePayload,
  extras: {
    shotPoints?: AimPoint[];
    keyPoints?: AimPoint[];
  } = {},
): HoleMapProjection {
  const fairwayPath = hole.fairway_path ?? [];
  const xs = [
    hole.tee.x,
    hole.green_center.x,
    ...(hole.pin_position ? [hole.pin_position.x] : []),
    hole.fairway_center_x - hole.fairway_width / 2 - hole.rough_width,
    hole.fairway_center_x + hole.fairway_width / 2 + hole.rough_width,
    ...fairwayPath.map((point) => point.x - hole.fairway_width / 2 - hole.rough_width),
    ...fairwayPath.map((point) => point.x + hole.fairway_width / 2 + hole.rough_width),
    ...hole.hazards.flatMap((hazard) => {
      const bounds = hazardBounds(hazard);
      return [bounds.xMin, bounds.xMax];
    }),
    ...(extras.shotPoints?.map((point) => point.x) ?? []),
    ...(extras.keyPoints?.map((point) => point.x) ?? []),
  ];
  const ys = [
    0,
    hole.green_center.y + hole.green_radius + 15,
    ...(hole.pin_position ? [hole.pin_position.y] : []),
    hole.fairway_start_y,
    hole.fairway_end_y,
    ...fairwayPath.map((point) => point.y),
    ...hole.hazards.flatMap((hazard) => {
      const bounds = hazardBounds(hazard);
      return [bounds.yMin, bounds.yMax];
    }),
    ...(extras.shotPoints?.map((point) => point.y) ?? []),
    ...(extras.keyPoints?.map((point) => point.y) ?? []),
  ];

  const padding = 24;
  const minX = Math.min(...xs) - padding;
  const maxX = Math.max(...xs) + padding;
  const minY = Math.min(...ys) - padding;
  const maxY = Math.max(...ys) + padding;
  const width = Math.max(maxX - minX, 140);
  const height = Math.max(maxY - minY, 240);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    toSvgX: (x) => x - minX,
    toSvgY: (y) => height - (y - minY),
    toHolePoint: (svgX, svgY) => ({
      x: svgX + minX,
      y: height - svgY + minY,
    }),
  };
}

export function fairwayPathForRender(hole: HolePayload): AimPoint[] {
  if (hole.fairway_path && hole.fairway_path.length >= 2) {
    return [...hole.fairway_path].sort((left, right) => left.y - right.y);
  }
  return [
    { x: hole.fairway_center_x, y: hole.fairway_start_y },
    { x: hole.fairway_center_x, y: hole.fairway_end_y },
  ];
}

export function fairwayPathSvg(path: AimPoint[], projection: HoleMapProjection): string {
  return path
    .map((point, index) => `${index === 0 ? "M" : "L"} ${projection.toSvgX(point.x)} ${projection.toSvgY(point.y)}`)
    .join(" ");
}
