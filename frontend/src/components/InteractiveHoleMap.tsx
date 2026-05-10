import { useMemo, useRef, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";

import type { AimPoint, HazardData, HolePayload } from "../types";
import { createHazard, normalizeHole, syncLegacyFairwayFields } from "../lib/holeEditor";
import { HoleEditorTool, toolToHazardKind } from "./HoleEditorToolbar";
import { fairwayPathForRender, fairwayPathSvg, getProjection } from "./holeMapGeometry";
import { flagPath, hazardPath, organicBlobPath, teeBoxPath } from "./holeVisuals";

interface InteractiveHoleMapProps {
  hole: HolePayload;
  tool: HoleEditorTool;
  selectedHazardIndex: number | null;
  onBeginEdit: (hole: HolePayload) => void;
  onChange: (hole: HolePayload) => void;
  onSelectHazard: (index: number | null) => void;
}

type DragState =
  | { kind: "move-green" }
  | { kind: "resize-green" }
  | { kind: "move-pin" }
  | { kind: "move-tee" }
  | { kind: "move-fairway"; origin: AimPoint; path: AimPoint[] }
  | { kind: "resize-fairway-width" }
  | { kind: "resize-rough-width" }
  | { kind: "move-hazard"; index: number; origin: AimPoint; hazard: HazardData }
  | { kind: "resize-hazard"; index: number; hazard: HazardData };

type SelectedEntity =
  | { kind: "green" }
  | { kind: "fairway" }
  | { kind: "rough" }
  | { kind: "tee" }
  | { kind: "pin" }
  | { kind: "hazard"; index: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundPoint(point: AimPoint): AimPoint {
  return { x: Number(point.x.toFixed(1)), y: Number(point.y.toFixed(1)) };
}

function clampPinToGreen(point: AimPoint, greenCenter: AimPoint, greenRadius: number): AimPoint {
  const dx = point.x - greenCenter.x;
  const dy = point.y - greenCenter.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= greenRadius || distance === 0) {
    return point;
  }
  const scale = greenRadius / distance;
  return roundPoint({
    x: greenCenter.x + dx * scale,
    y: greenCenter.y + dy * scale,
  });
}

function fairwayCenterAtY(path: AimPoint[], y: number): number {
  const sortedPath = [...path].sort((left, right) => left.y - right.y);
  if (sortedPath.length === 0) {
    return 0;
  }
  if (y <= sortedPath[0].y) {
    return sortedPath[0].x;
  }
  if (y >= sortedPath[sortedPath.length - 1].y) {
    return sortedPath[sortedPath.length - 1].x;
  }
  for (let index = 0; index < sortedPath.length - 1; index += 1) {
    const current = sortedPath[index];
    const next = sortedPath[index + 1];
    if (y >= current.y && y <= next.y) {
      const span = next.y - current.y || 1;
      const ratio = (y - current.y) / span;
      return Number((current.x + (next.x - current.x) * ratio).toFixed(1));
    }
  }
  return sortedPath[Math.floor(sortedPath.length / 2)]?.x ?? 0;
}

function hazardCenter(hazard: HazardData): AimPoint {
  if (hazard.shape === "corridor" && hazard.start_y != null && hazard.end_y != null) {
    return {
      x: hazard.center_x,
      y: Number(((hazard.start_y + hazard.end_y) / 2).toFixed(1)),
    };
  }
  return { x: hazard.center_x, y: hazard.center_y };
}

export function InteractiveHoleMap({
  hole,
  tool,
  selectedHazardIndex,
  onBeginEdit,
  onChange,
  onSelectHazard,
}: InteractiveHoleMapProps) {
  const normalizedHole = normalizeHole(hole);
  const fairwayPath = fairwayPathForRender(normalizedHole);
  const projection = useMemo(() => getProjection(normalizedHole), [normalizedHole]);
  const fairwayLine = fairwayPathSvg(fairwayPath, projection);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const pin = normalizedHole.pin_position ?? normalizedHole.green_center;
  const flag = flagPath(pin, projection);
  const greenPath = organicBlobPath(
    normalizedHole.green_center,
    normalizedHole.green_radius * 1.12,
    normalizedHole.green_radius * 0.92,
    projection,
    11,
  );
  const greenInnerPath = organicBlobPath(
    normalizedHole.green_center,
    normalizedHole.green_radius * 0.72,
    normalizedHole.green_radius * 0.58,
    projection,
    19,
  );
  const teePath = teeBoxPath(normalizedHole.tee, projection);

  function updateHole(nextHole: HolePayload) {
    onChange(normalizeHole(nextHole));
  }

  function getSvgPoint(event: MouseEvent<SVGSVGElement> | PointerEvent<SVGElement>) {
    const svg = svgRef.current;
    if (!svg) {
      return { x: 0, y: 0 };
    }
    const rect = svg.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * projection.width,
      y: ((event.clientY - rect.top) / rect.height) * projection.height,
    };
  }

  function toHolePoint(svgX: number, svgY: number): AimPoint {
    return projection.toHolePoint(svgX, svgY);
  }

  function holePointFromEvent(event: PointerEvent<SVGElement> | MouseEvent<SVGSVGElement>) {
    const point = getSvgPoint(event);
    return roundPoint(toHolePoint(point.x, point.y));
  }

  function startDrag(
    pointerId: number,
    nextDragState: DragState,
  ) {
    onBeginEdit(normalizedHole);
    setDragState(nextDragState);
    svgRef.current?.setPointerCapture(pointerId);
  }

  function handleCanvasClick(event: MouseEvent<SVGSVGElement>) {
    const point = holePointFromEvent(event);
    const hazardKind = toolToHazardKind(tool);

    if (hazardKind) {
      onBeginEdit(normalizedHole);
      const hazards = [...normalizedHole.hazards, createHazard(hazardKind, point)];
      updateHole({ ...normalizedHole, hazards });
      onSelectHazard(hazards.length - 1);
      setSelectedEntity({ kind: "hazard", index: hazards.length - 1 });
      return;
    }

    onSelectHazard(null);
    setSelectedEntity(null);
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!dragState) {
      return;
    }
    const point = holePointFromEvent(event);
    if (dragState.kind === "move-green") {
      const previousGreen = normalizedHole.green_center;
      const previousPin = normalizedHole.pin_position ?? previousGreen;
      const movedPin = roundPoint({
        x: previousPin.x + (point.x - previousGreen.x),
        y: previousPin.y + (point.y - previousGreen.y),
      });
      updateHole({
        ...normalizedHole,
        green_center: point,
        pin_position: clampPinToGreen(movedPin, point, normalizedHole.green_radius),
      });
      setSelectedEntity({ kind: "green" });
      return;
    }
    if (dragState.kind === "resize-green") {
      const radius = Number(Math.max(8, Math.hypot(point.x - normalizedHole.green_center.x, point.y - normalizedHole.green_center.y)).toFixed(1));
      updateHole({
        ...normalizedHole,
        green_radius: radius,
        pin_position: clampPinToGreen(pin, normalizedHole.green_center, radius),
      });
      setSelectedEntity({ kind: "green" });
      return;
    }
    if (dragState.kind === "move-pin") {
      updateHole({
        ...normalizedHole,
        pin_position: clampPinToGreen(point, normalizedHole.green_center, normalizedHole.green_radius),
      });
      setSelectedEntity({ kind: "pin" });
      return;
    }
    if (dragState.kind === "move-tee") {
      updateHole({ ...normalizedHole, tee: point });
      setSelectedEntity({ kind: "tee" });
      return;
    }
    if (dragState.kind === "move-fairway") {
      const dx = point.x - dragState.origin.x;
      const dy = point.y - dragState.origin.y;
      updateHole(
        syncLegacyFairwayFields(
          normalizedHole,
          dragState.path.map((pathPoint, index, path) =>
            roundPoint({
              x: pathPoint.x + dx,
              y: clamp(
                pathPoint.y + dy,
                index === 0 ? 10 : path[index - 1].y + 20,
                index === path.length - 1 ? normalizedHole.yardage : path[index + 1].y - 20,
              ),
            }),
          ),
        ),
      );
      setSelectedEntity({ kind: "fairway" });
      return;
    }
    if (dragState.kind === "resize-fairway-width") {
      const centerX = fairwayCenterAtY(fairwayPath, point.y);
      updateHole({ ...normalizedHole, fairway_width: Number(Math.max(12, Math.abs(point.x - centerX) * 2).toFixed(1)) });
      setSelectedEntity({ kind: "fairway" });
      return;
    }
    if (dragState.kind === "resize-rough-width") {
      const centerX = fairwayCenterAtY(fairwayPath, point.y);
      const totalHalf = Math.max(normalizedHole.fairway_width / 2 + 4, Math.abs(point.x - centerX));
      updateHole({ ...normalizedHole, rough_width: Number(Math.max(6, totalHalf - normalizedHole.fairway_width / 2).toFixed(1)) });
      setSelectedEntity({ kind: "rough" });
      return;
    }
    if (dragState.kind === "move-hazard") {
      const dx = point.x - dragState.origin.x;
      const dy = point.y - dragState.origin.y;
      updateHole({
        ...normalizedHole,
        hazards: normalizedHole.hazards.map((hazard, index) =>
          index === dragState.index
            ? {
                ...hazard,
                center_x: Number((dragState.hazard.center_x + dx).toFixed(1)),
                center_y: Number((dragState.hazard.center_y + dy).toFixed(1)),
                start_y: hazard.start_y != null ? Number((dragState.hazard.start_y! + dy).toFixed(1)) : hazard.start_y,
                end_y: hazard.end_y != null ? Number((dragState.hazard.end_y! + dy).toFixed(1)) : hazard.end_y,
              }
            : hazard,
        ),
      });
      onSelectHazard(dragState.index);
      setSelectedEntity({ kind: "hazard", index: dragState.index });
      return;
    }
    if (dragState.kind === "resize-hazard") {
      updateHole({
        ...normalizedHole,
        hazards: normalizedHole.hazards.map((hazard, index) => {
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
            const startY = hazard.start_y ?? hazard.center_y;
            const endY = Number(Math.max(startY + 12, point.y).toFixed(1));
            return {
              ...hazard,
              width: Number(Math.max(8, Math.abs(point.x - hazard.center_x) * 2).toFixed(1)),
              end_y: endY,
              center_y: Number(((startY + endY) / 2).toFixed(1)),
            };
          }
          return {
            ...hazard,
            width: Number(Math.max(8, Math.abs(point.x - hazard.center_x) * 2).toFixed(1)),
            depth: Number(Math.max(8, Math.abs(point.y - hazard.center_y) * 2).toFixed(1)),
          };
        }),
      });
      onSelectHazard(dragState.index);
      setSelectedEntity({ kind: "hazard", index: dragState.index });
    }
  }

  function handlePointerUp(event: PointerEvent<SVGSVGElement>) {
    if (dragState) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragState(null);
  }

  const midPoint = fairwayPath[Math.floor(fairwayPath.length / 2)] ?? { x: normalizedHole.fairway_center_x, y: normalizedHole.fairway_start_y };
  const fairwaySelected = selectedEntity?.kind === "fairway";
  const roughSelected = selectedEntity?.kind === "rough";
  const greenSelected = selectedEntity?.kind === "green";
  const teeSelected = selectedEntity?.kind === "tee";
  const pinSelected = selectedEntity?.kind === "pin";
  const selectedHazard =
    selectedEntity?.kind === "hazard" && normalizedHole.hazards[selectedEntity.index]
      ? normalizedHole.hazards[selectedEntity.index]
      : null;
  const selectedHazardCenter = selectedHazard ? hazardCenter(selectedHazard) : null;
  const selectedHazardIndexValue = selectedEntity?.kind === "hazard" ? selectedEntity.index : null;

  return (
    <section className="card map-card">
      <div className="card__header">
        <div>
          <p className="eyebrow">Designer</p>
          <h2>Interactive Hole Editor</h2>
          <p className="map-subtitle">
            Drag inside a feature to move it. Drag its border to resize it.
          </p>
        </div>
      </div>

      <div className="hole-map-stage hole-map-stage--editor">
        <svg
          ref={svgRef}
          className="hole-map hole-map--interactive"
          viewBox={`0 0 ${projection.width} ${projection.height}`}
          onClick={handleCanvasClick}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <defs>
            <linearGradient id="courseBase" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#d7c19a" />
              <stop offset="100%" stopColor="#cbb088" />
            </linearGradient>
            <linearGradient id="editorSandFill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ecd6a8" />
              <stop offset="100%" stopColor="#d7b77b" />
            </linearGradient>
            <linearGradient id="editorWaterFill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#74c1e4" />
              <stop offset="100%" stopColor="#3b8ebf" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width={projection.width} height={projection.height} rx="22" className="hole-map__base" />
          <g>
            <path
              d={fairwayLine}
              className={`hole-map__rough-path ${roughSelected ? "hole-map__path--selected" : ""}`}
              strokeWidth={normalizedHole.fairway_width + normalizedHole.rough_width * 2}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedEntity({ kind: "rough" });
                onSelectHazard(null);
              }}
            />
            <path d={fairwayLine} className="hole-map__fairway-shadow" strokeWidth={normalizedHole.fairway_width + 5} />
            <path
              d={fairwayLine}
              className={`hole-map__fairway-path ${fairwaySelected ? "hole-map__path--selected" : ""}`}
              strokeWidth={normalizedHole.fairway_width}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedEntity({ kind: "fairway" });
                onSelectHazard(null);
              }}
            />
            <path d={fairwayLine} className="hole-map__fairway-centerline" strokeWidth={1.6} />
            {fairwaySelected ? (
              <path
                d={fairwayLine}
                className="hole-map__selection-outline"
                strokeWidth={normalizedHole.fairway_width}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  startDrag(event.pointerId, { kind: "resize-fairway-width" });
                }}
              />
            ) : null}
            {roughSelected ? (
              <path
                d={fairwayLine}
                className="hole-map__selection-outline"
                strokeWidth={normalizedHole.fairway_width + normalizedHole.rough_width * 2}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  startDrag(event.pointerId, { kind: "resize-rough-width" });
                }}
              />
            ) : null}

            <path
              d={greenPath}
              className={`hole-map__green ${greenSelected ? "hole-map__green--selected" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedEntity({ kind: "green" });
                onSelectHazard(null);
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
                startDrag(event.pointerId, { kind: "move-green" });
              }}
            />
            <path d={greenInnerPath} className="hole-map__green-inner" />
            {greenSelected ? (
              <path
                d={greenPath}
                className="hole-map__selection-outline"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  startDrag(event.pointerId, { kind: "resize-green" });
                }}
              />
            ) : null}

            <path
              d={teePath}
              className={`hole-map__tee-box ${teeSelected ? "hole-map__tee-box--selected" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedEntity({ kind: "tee" });
                onSelectHazard(null);
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
                startDrag(event.pointerId, { kind: "move-tee" });
              }}
            />

            {normalizedHole.hazards.map((hazard, index) => {
              const organicPath = hazardPath(hazard, projection, index + 3);
              const commonClick = (event: MouseEvent<SVGElement>) => {
                event.stopPropagation();
                onSelectHazard(index);
                setSelectedEntity({ kind: "hazard", index });
              };
              const commonPointerDown = (event: PointerEvent<SVGElement>) => {
                event.stopPropagation();
                startDrag(event.pointerId, { kind: "move-hazard", index, origin: holePointFromEvent(event), hazard });
              };
              if (organicPath) {
                return (
                  <path
                    key={`${hazard.kind}-${index}`}
                    d={organicPath}
                    fill={hazard.kind === "water" ? "url(#editorWaterFill)" : hazard.kind === "bunker" ? "url(#editorSandFill)" : undefined}
                    className={`hole-map__hazard-fill hole-map__hazard-fill--${hazard.kind} ${selectedHazardIndex === index ? "hole-map__hazard-fill--selected" : ""}`}
                    onClick={commonClick}
                    onPointerDown={commonPointerDown}
                  />
                );
              }
              if (hazard.shape === "corridor" && hazard.width && hazard.start_y != null && hazard.end_y != null) {
                return (
                  <g key={`${hazard.kind}-${index}`} onClick={commonClick} onPointerDown={commonPointerDown}>
                    <rect
                      x={projection.toSvgX(hazard.center_x - hazard.width / 2)}
                      y={projection.toSvgY(hazard.end_y)}
                      width={hazard.width}
                      height={hazard.end_y - hazard.start_y}
                      className={`hole-map__ob-corridor ${selectedHazardIndex === index ? "hole-map__ob-corridor--selected" : ""}`}
                    />
                    <line
                      x1={projection.toSvgX(hazard.center_x - hazard.width / 2)}
                      y1={projection.toSvgY(hazard.start_y)}
                      x2={projection.toSvgX(hazard.center_x - hazard.width / 2)}
                      y2={projection.toSvgY(hazard.end_y)}
                      className="hole-map__ob-line"
                    />
                    <line
                      x1={projection.toSvgX(hazard.center_x + hazard.width / 2)}
                      y1={projection.toSvgY(hazard.start_y)}
                      x2={projection.toSvgX(hazard.center_x + hazard.width / 2)}
                      y2={projection.toSvgY(hazard.end_y)}
                      className="hole-map__ob-line"
                    />
                  </g>
                );
              }
              return null;
            })}

            <path d={flag.pole} className="hole-map__pin-pole" />
            <path d={flag.flag} className="hole-map__pin-flag" />
            <circle
              cx={projection.toSvgX(pin.x)}
              cy={projection.toSvgY(pin.y)}
              r="3.5"
              className="hole-map__pin-point"
              onClick={(event) => {
                event.stopPropagation();
                setSelectedEntity({ kind: "pin" });
                onSelectHazard(null);
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
                startDrag(event.pointerId, { kind: "move-pin" });
              }}
            />
            {pinSelected ? (
              <circle
                cx={projection.toSvgX(pin.x)}
                cy={projection.toSvgY(pin.y)}
                r="8"
                className="hole-map__selection-outline-circle"
              />
            ) : null}

            {greenSelected ? (
              <circle
                cx={projection.toSvgX(normalizedHole.green_center.x)}
                cy={projection.toSvgY(normalizedHole.green_center.y)}
                r="10"
                className="hole-map__move-handle"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  startDrag(event.pointerId, { kind: "move-green" });
                }}
              />
            ) : null}
            {fairwaySelected ? (
              <circle
                cx={projection.toSvgX(midPoint.x)}
                cy={projection.toSvgY(midPoint.y)}
                r="10"
                className="hole-map__move-handle"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  startDrag(event.pointerId, { kind: "move-fairway", origin: midPoint, path: fairwayPath });
                }}
              />
            ) : null}
            {roughSelected ? (
              <circle
                cx={projection.toSvgX(midPoint.x)}
                cy={projection.toSvgY(midPoint.y)}
                r="10"
                className="hole-map__move-handle"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  startDrag(event.pointerId, { kind: "move-fairway", origin: midPoint, path: fairwayPath });
                }}
              />
            ) : null}
            {teeSelected ? (
              <circle
                cx={projection.toSvgX(normalizedHole.tee.x)}
                cy={projection.toSvgY(normalizedHole.tee.y)}
                r="10"
                className="hole-map__move-handle"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  startDrag(event.pointerId, { kind: "move-tee" });
                }}
              />
            ) : null}
            {pinSelected ? (
              <circle
                cx={projection.toSvgX(pin.x)}
                cy={projection.toSvgY(pin.y)}
                r="10"
                className="hole-map__move-handle"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  startDrag(event.pointerId, { kind: "move-pin" });
                }}
              />
            ) : null}
            {selectedHazard && selectedHazardCenter ? (
              <>
                {hazardPath(selectedHazard, projection, 97) ? (
                  <path
                    d={hazardPath(selectedHazard, projection, 97)!}
                    className="hole-map__selection-outline"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      startDrag(event.pointerId, {
                        kind: "resize-hazard",
                        index: selectedHazardIndexValue ?? 0,
                        hazard: selectedHazard,
                      });
                    }}
                  />
                ) : null}
                {selectedHazard.shape === "corridor" && selectedHazard.width && selectedHazard.start_y != null && selectedHazard.end_y != null ? (
                  <rect
                    x={projection.toSvgX(selectedHazard.center_x - selectedHazard.width / 2)}
                    y={projection.toSvgY(selectedHazard.end_y)}
                    width={selectedHazard.width}
                    height={selectedHazard.end_y - selectedHazard.start_y}
                    className="hole-map__selection-outline-rect"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      startDrag(event.pointerId, {
                        kind: "resize-hazard",
                        index: selectedHazardIndexValue ?? 0,
                        hazard: selectedHazard,
                      });
                    }}
                  />
                ) : null}
                <circle
                  cx={projection.toSvgX(selectedHazardCenter.x)}
                  cy={projection.toSvgY(selectedHazardCenter.y)}
                  r="10"
                  className="hole-map__move-handle"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    startDrag(event.pointerId, {
                      kind: "move-hazard",
                      index: selectedHazardIndexValue ?? 0,
                      origin: selectedHazardCenter,
                      hazard: selectedHazard,
                    });
                  }}
                />
              </>
            ) : null}
          </g>
        </svg>
      </div>

      <div className="map-legend">
        <span><i className="legend-swatch legend-swatch--fairway" /> Fairway</span>
        <span><i className="legend-swatch legend-swatch--rough" /> Rough</span>
        <span><i className="legend-swatch legend-swatch--green" /> Green</span>
        <span><i className="legend-swatch legend-swatch--bunker" /> Bunker</span>
        <span><i className="legend-swatch legend-swatch--water" /> Water</span>
        <span><i className="legend-swatch legend-swatch--ob" /> OB</span>
        <span><i className="legend-swatch legend-swatch--pin" /> Pin</span>
      </div>
    </section>
  );
}
