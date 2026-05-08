import { useMemo, useRef, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";

import type { AimPoint, HazardData, HolePayload } from "../types";
import { createHazard, normalizeHole, syncLegacyFairwayFields } from "../lib/holeEditor";
import { EditableCourseFeature } from "./EditableCourseFeature";
import { HoleEditorTool, toolToHazardKind } from "./HoleEditorToolbar";
import { fairwayPathForRender, fairwayPathSvg, getProjection } from "./holeMapGeometry";

interface InteractiveHoleMapProps {
  hole: HolePayload;
  tool: HoleEditorTool;
  selectedHazardIndex: number | null;
  onChange: (hole: HolePayload) => void;
  onSelectHazard: (index: number | null) => void;
}

type DragState =
  | { kind: "green-center" }
  | { kind: "green-radius" }
  | { kind: "pin" }
  | { kind: "fairway-point"; index: number }
  | { kind: "fairway-width" }
  | { kind: "rough-width" }
  | { kind: "hazard-move"; index: number; origin: AimPoint; hazard: HazardData }
  | { kind: "hazard-resize"; index: number; origin: AimPoint; hazard: HazardData };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundPoint(point: AimPoint): AimPoint {
  return { x: Number(point.x.toFixed(1)), y: Number(point.y.toFixed(1)) };
}

export function InteractiveHoleMap({
  hole,
  tool,
  selectedHazardIndex,
  onChange,
  onSelectHazard,
}: InteractiveHoleMapProps) {
  const normalizedHole = normalizeHole(hole);
  const fairwayPath = fairwayPathForRender(normalizedHole);
  const projection = useMemo(() => getProjection(normalizedHole), [normalizedHole]);
  const fairwayLine = fairwayPathSvg(fairwayPath, projection);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  function eventToHolePoint(event: PointerEvent<SVGElement>) {
    const svg = svgRef.current;
    if (!svg) {
      return { x: 0, y: 0 };
    }
    const rect = svg.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * projection.width;
    const svgY = ((event.clientY - rect.top) / rect.height) * projection.height;
    return projection.toHolePoint(svgX, svgY);
  }

  function updateHole(nextHole: HolePayload) {
    onChange(normalizeHole(nextHole));
  }

  function beginDrag(pointerId: number, nextState: DragState) {
    setDragState(nextState);
    svgRef.current?.setPointerCapture(pointerId);
  }

  function handleCanvasClick(event: MouseEvent<SVGSVGElement>) {
    const hazardKind = toolToHazardKind(tool);
    if (!hazardKind) {
      onSelectHazard(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * projection.width;
    const svgY = ((event.clientY - rect.top) / rect.height) * projection.height;
    const point = projection.toHolePoint(svgX, svgY);
    const hazards = [...normalizedHole.hazards, createHazard(hazardKind, roundPoint(point))];
    updateHole({ ...normalizedHole, hazards });
    onSelectHazard(hazards.length - 1);
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!dragState) {
      return;
    }
    const point = roundPoint(eventToHolePoint(event));
    if (dragState.kind === "green-center") {
      const previousGreen = normalizedHole.green_center;
      const previousPin = normalizedHole.pin_position ?? previousGreen;
      const movedPin =
        Math.abs(previousPin.x - previousGreen.x) < 0.001 && Math.abs(previousPin.y - previousGreen.y) < 0.001
          ? point
          : {
              x: previousPin.x + (point.x - previousGreen.x),
              y: previousPin.y + (point.y - previousGreen.y),
            };
      updateHole({
        ...normalizedHole,
        green_center: point,
        pin_position: movedPin,
      });
      return;
    }
    if (dragState.kind === "green-radius") {
      const radius = Math.max(8, Math.hypot(point.x - normalizedHole.green_center.x, point.y - normalizedHole.green_center.y));
      updateHole({ ...normalizedHole, green_radius: Number(radius.toFixed(1)) });
      return;
    }
    if (dragState.kind === "pin") {
      const dx = point.x - normalizedHole.green_center.x;
      const dy = point.y - normalizedHole.green_center.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= normalizedHole.green_radius) {
        updateHole({ ...normalizedHole, pin_position: point });
      }
      return;
    }
    if (dragState.kind === "fairway-point") {
      const nextPath = fairwayPath.map((pathPoint, index) =>
        index === dragState.index
          ? {
              x: clamp(point.x, -140, 140),
              y: clamp(point.y, index === 0 ? 15 : fairwayPath[index - 1].y + 20, index === fairwayPath.length - 1 ? normalizedHole.yardage : fairwayPath[index + 1].y - 20),
            }
          : pathPoint,
      );
      updateHole(syncLegacyFairwayFields(normalizedHole, nextPath));
      return;
    }
    if (dragState.kind === "fairway-width") {
      const mid = fairwayPath[Math.floor(fairwayPath.length / 2)];
      const width = Math.max(12, Math.abs(point.x - mid.x) * 2);
      updateHole({ ...normalizedHole, fairway_width: Number(width.toFixed(1)) });
      return;
    }
    if (dragState.kind === "rough-width") {
      const mid = fairwayPath[Math.floor(fairwayPath.length / 2)];
      const totalHalf = Math.max(normalizedHole.fairway_width / 2 + 4, Math.abs(point.x - mid.x));
      const roughWidth = Math.max(6, totalHalf - normalizedHole.fairway_width / 2);
      updateHole({ ...normalizedHole, rough_width: Number(roughWidth.toFixed(1)) });
      return;
    }
    if (dragState.kind === "hazard-move") {
      const dx = point.x - dragState.origin.x;
      const dy = point.y - dragState.origin.y;
      const hazards = normalizedHole.hazards.map((hazard, index) => {
        if (index !== dragState.index) {
          return hazard;
        }
        return {
          ...hazard,
          center_x: Number((dragState.hazard.center_x + dx).toFixed(1)),
          center_y: Number((dragState.hazard.center_y + dy).toFixed(1)),
          start_y: hazard.start_y != null ? Number((dragState.hazard.start_y! + dy).toFixed(1)) : hazard.start_y,
          end_y: hazard.end_y != null ? Number((dragState.hazard.end_y! + dy).toFixed(1)) : hazard.end_y,
          x_min: hazard.x_min != null ? Number((dragState.hazard.x_min! + dx).toFixed(1)) : hazard.x_min,
          x_max: hazard.x_max != null ? Number((dragState.hazard.x_max! + dx).toFixed(1)) : hazard.x_max,
          y_min: hazard.y_min != null ? Number((dragState.hazard.y_min! + dy).toFixed(1)) : hazard.y_min,
          y_max: hazard.y_max != null ? Number((dragState.hazard.y_max! + dy).toFixed(1)) : hazard.y_max,
        };
      });
      updateHole({ ...normalizedHole, hazards });
      return;
    }
    if (dragState.kind === "hazard-resize") {
      const hazards = normalizedHole.hazards.map((hazard, index) => {
        if (index !== dragState.index) {
          return hazard;
        }
        if (hazard.shape === "circle") {
          return {
            ...hazard,
            radius: Number(Math.max(6, Math.hypot(point.x - hazard.center_x, point.y - hazard.center_y)).toFixed(1)),
          };
        }
        if (hazard.shape === "corridor") {
          return {
            ...hazard,
            width: Number(Math.max(8, Math.abs(point.x - hazard.center_x) * 2).toFixed(1)),
            end_y: Number(Math.max((hazard.start_y ?? hazard.center_y) + 12, point.y).toFixed(1)),
            center_y: Number((((hazard.start_y ?? hazard.center_y) + Math.max((hazard.start_y ?? hazard.center_y) + 12, point.y)) / 2).toFixed(1)),
          };
        }
        return {
          ...hazard,
          width: Number(Math.max(8, Math.abs(point.x - hazard.center_x) * 2).toFixed(1)),
          depth: Number(Math.max(8, Math.abs(point.y - hazard.center_y) * 2).toFixed(1)),
        };
      });
      updateHole({ ...normalizedHole, hazards });
    }
  }

  function handlePointerUp(event: React.PointerEvent<SVGSVGElement>) {
    if (dragState) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragState(null);
  }

  const pin = normalizedHole.pin_position ?? normalizedHole.green_center;
  const midPoint = fairwayPath[Math.floor(fairwayPath.length / 2)] ?? { x: normalizedHole.fairway_center_x, y: normalizedHole.fairway_start_y };
  const fairwayWidthHandle = {
    x: midPoint.x + normalizedHole.fairway_width / 2,
    y: midPoint.y,
  };
  const roughWidthHandle = {
    x: midPoint.x + normalizedHole.fairway_width / 2 + normalizedHole.rough_width,
    y: midPoint.y,
  };

  return (
    <section className="card">
      <div className="card__header">
        <div>
          <p className="eyebrow">Designer</p>
          <h2>Interactive Hole Editor</h2>
          <p className="map-subtitle">Drag the green, pin, fairway path, and hazards directly on the course.</p>
        </div>
      </div>
      <svg
        ref={svgRef}
        className="hole-map hole-map--interactive"
        viewBox={`0 0 ${projection.width} ${projection.height}`}
        onClick={handleCanvasClick}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <rect x="0" y="0" width={projection.width} height={projection.height} rx="20" className="hole-map__base" />
        <path d={fairwayLine} className="hole-map__rough-path" strokeWidth={normalizedHole.fairway_width + normalizedHole.rough_width * 2} />
        <path d={fairwayLine} className="hole-map__fairway-path" strokeWidth={normalizedHole.fairway_width} />

        <circle
          cx={projection.toSvgX(normalizedHole.green_center.x)}
          cy={projection.toSvgY(normalizedHole.green_center.y)}
          r={normalizedHole.green_radius}
          className="hole-map__green"
          onPointerDown={(event) => {
            event.stopPropagation();
            beginDrag(event.pointerId, { kind: "green-center" });
          }}
        />
        <circle
          cx={projection.toSvgX(normalizedHole.tee.x)}
          cy={projection.toSvgY(normalizedHole.tee.y)}
          r="5"
          className="hole-map__tee"
        />

        {normalizedHole.hazards.map((hazard, index) => {
          const isSelected = selectedHazardIndex === index;
          const commonProps = {
            onClick: (event: MouseEvent<SVGElement>) => {
              event.stopPropagation();
              onSelectHazard(index);
            },
            onPointerDown: (event: PointerEvent<SVGElement>) => {
              event.stopPropagation();
              onSelectHazard(index);
              beginDrag(event.pointerId, {
                kind: "hazard-move",
                index,
                origin: eventToHolePoint(event),
                hazard,
              });
            },
            className: isSelected ? "hole-map__hazard hole-map__hazard--selected" : "hole-map__hazard",
          };

          if (hazard.shape === "circle" && hazard.radius) {
            return (
              <g key={`${hazard.kind}-${index}`}>
                <circle
                  cx={projection.toSvgX(hazard.center_x)}
                  cy={projection.toSvgY(hazard.center_y)}
                  r={hazard.radius}
                  fill={hazard.kind === "ob" ? "#d9534f" : hazard.kind === "water" ? "#69a9d6" : hazard.kind === "recovery" ? "#8d6a4d" : "#e6c98c"}
                  opacity="0.88"
                  {...commonProps}
                />
                {isSelected ? (
                  <EditableCourseFeature
                    x={projection.toSvgX(hazard.center_x + hazard.radius)}
                    y={projection.toSvgY(hazard.center_y)}
                    label={hazard.kind}
                    selected
                    onPointerDown={(pointerId) =>
                      beginDrag(pointerId, {
                        kind: "hazard-resize",
                        index,
                        origin: { x: hazard.center_x, y: hazard.center_y },
                        hazard,
                      })
                    }
                  />
                ) : null}
              </g>
            );
          }
          if (hazard.shape === "rectangle" && hazard.width && hazard.depth) {
            return (
              <g key={`${hazard.kind}-${index}`}>
                <rect
                  x={projection.toSvgX(hazard.center_x - hazard.width / 2)}
                  y={projection.toSvgY(hazard.center_y + hazard.depth / 2)}
                  width={hazard.width}
                  height={hazard.depth}
                  fill={hazard.kind === "water" ? "#69a9d6" : hazard.kind === "recovery" ? "#8d6a4d" : "#e6c98c"}
                  opacity="0.88"
                  rx="8"
                  {...commonProps}
                />
                {isSelected ? (
                  <EditableCourseFeature
                    x={projection.toSvgX(hazard.center_x + hazard.width / 2)}
                    y={projection.toSvgY(hazard.center_y - hazard.depth / 2)}
                    label={hazard.kind}
                    selected
                    onPointerDown={(pointerId) =>
                      beginDrag(pointerId, {
                        kind: "hazard-resize",
                        index,
                        origin: { x: hazard.center_x, y: hazard.center_y },
                        hazard,
                      })
                    }
                  />
                ) : null}
              </g>
            );
          }
          if (hazard.shape === "corridor" && hazard.width && hazard.start_y != null && hazard.end_y != null) {
            return (
              <g key={`${hazard.kind}-${index}`}>
                <rect
                  x={projection.toSvgX(hazard.center_x - hazard.width / 2)}
                  y={projection.toSvgY(hazard.end_y)}
                  width={hazard.width}
                  height={hazard.end_y - hazard.start_y}
                  fill="#d9534f"
                  opacity="0.65"
                  rx="8"
                  {...commonProps}
                />
                {isSelected ? (
                  <EditableCourseFeature
                    x={projection.toSvgX(hazard.center_x + hazard.width / 2)}
                    y={projection.toSvgY(hazard.end_y)}
                    label={hazard.kind}
                    selected
                    onPointerDown={(pointerId) =>
                      beginDrag(pointerId, {
                        kind: "hazard-resize",
                        index,
                        origin: { x: hazard.center_x, y: hazard.center_y },
                        hazard,
                      })
                    }
                  />
                ) : null}
              </g>
            );
          }
          return null;
        })}

        {fairwayPath.map((point, index) => (
          <EditableCourseFeature
            key={`fairway-${index}`}
            x={projection.toSvgX(point.x)}
            y={projection.toSvgY(point.y)}
            label={index === 0 ? "Fairway start" : index === fairwayPath.length - 1 ? "Fairway end" : "Fairway bend"}
            onPointerDown={(pointerId) => beginDrag(pointerId, { kind: "fairway-point", index })}
          />
        ))}
        <EditableCourseFeature
          x={projection.toSvgX(fairwayWidthHandle.x)}
          y={projection.toSvgY(fairwayWidthHandle.y)}
          label="Fairway width"
          onPointerDown={(pointerId) => beginDrag(pointerId, { kind: "fairway-width" })}
        />
        <EditableCourseFeature
          x={projection.toSvgX(roughWidthHandle.x)}
          y={projection.toSvgY(roughWidthHandle.y)}
          label="Rough width"
          onPointerDown={(pointerId) => beginDrag(pointerId, { kind: "rough-width" })}
        />
        <EditableCourseFeature
          x={projection.toSvgX(normalizedHole.green_center.x)}
          y={projection.toSvgY(normalizedHole.green_center.y)}
          label="Green"
          onPointerDown={(pointerId) => beginDrag(pointerId, { kind: "green-center" })}
        />
        <EditableCourseFeature
          x={projection.toSvgX(normalizedHole.green_center.x + normalizedHole.green_radius)}
          y={projection.toSvgY(normalizedHole.green_center.y)}
          label="Green size"
          onPointerDown={(pointerId) => beginDrag(pointerId, { kind: "green-radius" })}
        />
        <EditableCourseFeature
          x={projection.toSvgX(pin.x)}
          y={projection.toSvgY(pin.y)}
          label="Pin"
          onPointerDown={(pointerId) => beginDrag(pointerId, { kind: "pin" })}
        />
      </svg>
    </section>
  );
}
