import type { AimPoint, HazardData } from "../types";
import type { HoleMapProjection } from "./holeMapGeometry";

function seededOffset(seed: number, multiplier: number): number {
  return Math.sin(seed * 12.9898) * multiplier;
}

export function organicBlobPath(
  center: AimPoint,
  radiusX: number,
  radiusY: number,
  projection: HoleMapProjection,
  seed = 1,
): string {
  const points = Array.from({ length: 8 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 8;
    const wobble = 1 + seededOffset(seed + index, 0.12);
    return {
      x: projection.toSvgX(center.x + Math.cos(angle) * radiusX * wobble),
      y: projection.toSvgY(center.y + Math.sin(angle) * radiusY * wobble),
    };
  });

  const path: string[] = [`M ${points[0].x} ${points[0].y}`];
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const controlX = (current.x + next.x) / 2;
    const controlY = (current.y + next.y) / 2;
    path.push(`Q ${current.x} ${current.y} ${controlX} ${controlY}`);
  }
  path.push("Z");
  return path.join(" ");
}

export function hazardPath(hazard: HazardData, projection: HoleMapProjection, seed = 1): string | null {
  if (hazard.shape === "circle" && hazard.radius) {
    return organicBlobPath(
      { x: hazard.center_x, y: hazard.center_y },
      hazard.radius * 1.15,
      hazard.radius * 0.9,
      projection,
      seed,
    );
  }

  if (hazard.shape === "rectangle" && hazard.width && hazard.depth) {
    return organicBlobPath(
      { x: hazard.center_x, y: hazard.center_y },
      hazard.width / 2,
      hazard.depth / 2,
      projection,
      seed,
    );
  }

  return null;
}

export function teeBoxPath(tee: AimPoint, projection: HoleMapProjection): string {
  const left = projection.toSvgX(tee.x - 7);
  const right = projection.toSvgX(tee.x + 7);
  const top = projection.toSvgY(tee.y + 5);
  const bottom = projection.toSvgY(tee.y - 5);
  return [
    `M ${left} ${bottom}`,
    `L ${right} ${bottom}`,
    `Q ${right + 4} ${(bottom + top) / 2} ${right} ${top}`,
    `L ${left} ${top}`,
    `Q ${left - 4} ${(bottom + top) / 2} ${left} ${bottom}`,
    "Z",
  ].join(" ");
}

export function flagPath(pin: AimPoint, projection: HoleMapProjection): { pole: string; flag: string } {
  const x = projection.toSvgX(pin.x);
  const y = projection.toSvgY(pin.y);
  return {
    pole: `M ${x} ${y + 7} L ${x} ${y - 14}`,
    flag: `M ${x} ${y - 13} L ${x + 10} ${y - 10} L ${x} ${y - 6} Z`,
  };
}
