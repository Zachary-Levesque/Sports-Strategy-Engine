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
  | { kind: "move-green"; start: AimPoint; greenCenter: AimPoint; pin: AimPoint }
  | { kind: "resize-green"; center: AimPoint }
  | { kind: "move-pin"; center: AimPoint }
  | { kind: "move-tee"; start: AimPoint; tee: AimPoint }
  | { kind: "move-fairway"; start: AimPoint; path: AimPoint[] }
  | { kind: "resize-fairway-width"; centerX: number; width: number }
  | { kind: "resize-rough-width"; centerX: number; fairwayWidth: number; roughWidth: number }
  | { kind: "move-hazard"; index: number; start: AimPoint; hazard: HazardData }
  | { kind: "resize-hazard"; index: number; hazard: HazardData; handle: "radius" | "left" | "right" | "top" | "bottom" };

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

function hazardCenter(hazard: HazardData): AimPoint {
  if (hazard.shape === "corridor" && hazard.start_y != null && hazard.end_y != null) {
    return {
      x: hazard.center_x,
      y: Number(((hazard.start_y + hazard.end_y) / 2).toFixed(1)),
    };
  }
  return { x: hazard.center_x, y: hazard.center_y };
}

function translatePoint(point: AimPoint, dx: number, dy: number): AimPoint {
  return roundPoint({ x: point.x + dx, y: point.y + dy });
}

function rectHandlePoint(hazard: HazardData, handle: "left" | "right" | "top" | "bottom"): AimPoint | null {
  if (hazard.shape === "circle" && hazard.radius) {
    return { x: hazard.center_x + hazard.radius, y: hazard.center_y };
  }
  if (hazard.shape === "rectangle" && hazard.width && hazard.depth) {
    if (handle === "left") {
      return { x: hazard.center_x - hazard.width / 2, y: hazard.center_y };
    }
    if (handle === "right") {
      return { x: hazard.center_x + hazard.width / 2, y: hazard.center_y };
    }
    if (handle === "top") {
      return { x: hazard.center_x, y: hazard.center_y + hazard.depth / 2 };
    }
    return { x: hazard.center_x, y: hazard.center_y - hazard.depth / 2 };
  }
  if (hazard.shape === "corridor" && hazard.width && hazard.start_y != null && hazard.end_y != null) {
    if (handle === "left") {
      return { x: hazard.center_x - hazard.width / 2, y: (hazard.start_y + hazard.end_y) / 2 };
    }
    if (handle === "right") {
      return { x: hazard.center_x + hazard.width / 2, y: (hazard.start_y + hazard.end_y) / 2 };
    }
    if (handle === "top") {
      return { x: hazard.center_x, y: hazard.end_y };
    }
    return { x: hazard.center_x, y: hazard.start_y };
  }
  return null;
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
      const dx = point.x - dragState.start.x;
      const dy = point.y - dragState.start.y;
      const nextCenter = translatePoint(dragState.greenCenter, dx, dy);
      const movedPin = translatePoint(dragState.pin, dx, dy);
      updateHole({
        ...normalizedHole,
        green_center: nextCenter,
        pin_position: clampPinToGreen(movedPin, nextCenter, normalizedHole.green_radius),
      });
      setSelectedEntity({ kind: "green" });
      return;
    }
    if (dragState.kind === "resize-green") {
      const radius = Number(Math.max(8, Math.hypot(point.x - dragState.center.x, point.y - dragState.center.y)).toFixed(1));
      updateHole({
        ...normalizedHole,
        green_radius: radius,
        pin_position: clampPinToGreen(pin, dragState.center, radius),
      });
      setSelectedEntity({ kind: "green" });
      return;
    }
    if (dragState.kind === "move-pin") {
      updateHole({
        ...normalizedHole,
        pin_position: clampPinToGreen(point, dragState.center, normalizedHole.green_radius),
      });
      setSelectedEntity({ kind: "pin" });
      return;
    }
    if (dragState.kind === "move-tee") {
      const dx = point.x - dragState.start.x;
      const dy = point.y - dragState.start.y;
      updateHole({ ...normalizedHole, tee: translatePoint(dragState.tee, dx, dy) });
      setSelectedEntity({ kind: "tee" });
      return;
    }
    if (dragState.kind === "move-fairway") {
      const dx = point.x - dragState.start.x;
      const dy = point.y - dragState.start.y;
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
      updateHole({
        ...normalizedHole,
        fairway_width: Number(Math.max(12, Math.abs(point.x - dragState.centerX) * 2).toFixed(1)),
      });
      setSelectedEntity({ kind: "fairway" });
      return;
    }
    if (dragState.kind === "resize-rough-width") {
      const totalHalf = Math.max(dragState.fairwayWidth / 2 + 4, Math.abs(point.x - dragState.centerX));
      updateHole({
        ...normalizedHole,
        rough_width: Number(Math.max(6, totalHalf - dragState.fairwayWidth / 2).toFixed(1)),
      });
      setSelectedEntity({ kind: "rough" });
      return;
    }
    if (dragState.kind === "move-hazard") {
      const dx = point.x - dragState.start.x;
      const dy = point.y - dragState.start.y;
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
              radius: Number(
                Math.max(6, Math.hypot(point.x - dragState.hazard.center_x, point.y - dragState.hazard.center_y)).toFixed(1),
              ),
            };
          }
          if (hazard.shape === "corridor") {
            const startY = dragState.hazard.start_y ?? dragState.hazard.center_y;
            const endY = dragState.hazard.end_y ?? dragState.hazard.center_y;
            if (dragState.handle === "left" || dragState.handle === "right") {
              return {
                ...hazard,
                width: Number(Math.max(8, Math.abs(point.x - dragState.hazard.center_x) * 2).toFixed(1)),
              };
            }
            if (dragState.handle === "top") {
              const nextEnd = Number(Math.max(startY + 12, point.y).toFixed(1));
              return {
                ...hazard,
                end_y: nextEnd,
                center_y: Number(((startY + nextEnd) / 2).toFixed(1)),
              };
            }
            return {
              ...hazard,
              start_y: Number(Math.min(point.y, endY - 12).toFixed(1)),
              center_y: Number(((Math.min(point.y, endY - 12) + endY) / 2).toFixed(1)),
            };
          }
          const halfWidth = Math.max(4, Math.abs(point.x - dragState.hazard.center_x));
          const halfDepth = Math.max(4, Math.abs(point.y - dragState.hazard.center_y));
          return {
            ...hazard,
            width: Number((halfWidth * 2).toFixed(1)),
            depth: Number((halfDepth * 2).toFixed(1)),
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
  const hazardLeftHandle = selectedHazard ? rectHandlePoint(selectedHazard, "left") : null;
  const hazardRightHandle = selectedHazard ? rectHandlePoint(selectedHazard, "right") : null;
  const hazardTopHandle = selectedHazard ? rectHandlePoint(selectedHazard, "top") : null;
  const hazardBottomHandle = selectedHazard ? rectHandlePoint(selectedHazard, "bottom") : null;

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
              />
            ) : null}
            {roughSelected ? (
              <path
                d={fairwayLine}
                className="hole-map__selection-outline"
                strokeWidth={normalizedHole.fairway_width + normalizedHole.rough_width * 2}
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
            />
            <path d={greenInnerPath} className="hole-map__green-inner" />
            {greenSelected ? (
              <path
                d={greenPath}
                className="hole-map__selection-outline"
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
                  startDrag(event.pointerId, {
                    kind: "move-green",
                    start: normalizedHole.green_center,
                    greenCenter: normalizedHole.green_center,
                    pin,
                  });
                }}
              />
            ) : null}
            {greenSelected ? (
              <circle
                cx={projection.toSvgX(normalizedHole.green_center.x + normalizedHole.green_radius)}
                cy={projection.toSvgY(normalizedHole.green_center.y)}
                r="7"
                className="hole-map__resize-handle"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  startDrag(event.pointerId, { kind: "resize-green", center: normalizedHole.green_center });
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
                  startDrag(event.pointerId, { kind: "move-fairway", start: midPoint, path: fairwayPath });
                }}
              />
            ) : null}
            {fairwaySelected ? (
              <>
                <circle
                  cx={projection.toSvgX(midPoint.x - normalizedHole.fairway_width / 2)}
                  cy={projection.toSvgY(midPoint.y)}
                  r="7"
                  className="hole-map__resize-handle"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    startDrag(event.pointerId, {
                      kind: "resize-fairway-width",
                      centerX: midPoint.x,
                      width: normalizedHole.fairway_width,
                    });
                  }}
                />
                <circle
                  cx={projection.toSvgX(midPoint.x + normalizedHole.fairway_width / 2)}
                  cy={projection.toSvgY(midPoint.y)}
                  r="7"
                  className="hole-map__resize-handle"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    startDrag(event.pointerId, {
                      kind: "resize-fairway-width",
                      centerX: midPoint.x,
                      width: normalizedHole.fairway_width,
                    });
                  }}
                />
              </>
            ) : null}
            {roughSelected ? (
              <circle
                cx={projection.toSvgX(midPoint.x)}
                cy={projection.toSvgY(midPoint.y)}
                r="10"
                className="hole-map__move-handle"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  startDrag(event.pointerId, { kind: "move-fairway", start: midPoint, path: fairwayPath });
                }}
              />
            ) : null}
            {roughSelected ? (
              <>
                <circle
                  cx={projection.toSvgX(midPoint.x - (normalizedHole.fairway_width / 2 + normalizedHole.rough_width))}
                  cy={projection.toSvgY(midPoint.y)}
                  r="7"
                  className="hole-map__resize-handle"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    startDrag(event.pointerId, {
                      kind: "resize-rough-width",
                      centerX: midPoint.x,
                      fairwayWidth: normalizedHole.fairway_width,
                      roughWidth: normalizedHole.rough_width,
                    });
                  }}
                />
                <circle
                  cx={projection.toSvgX(midPoint.x + normalizedHole.fairway_width / 2 + normalizedHole.rough_width)}
                  cy={projection.toSvgY(midPoint.y)}
                  r="7"
                  className="hole-map__resize-handle"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    startDrag(event.pointerId, {
                      kind: "resize-rough-width",
                      centerX: midPoint.x,
                      fairwayWidth: normalizedHole.fairway_width,
                      roughWidth: normalizedHole.rough_width,
                    });
                  }}
                />
              </>
            ) : null}
            {teeSelected ? (
              <circle
                cx={projection.toSvgX(normalizedHole.tee.x)}
                cy={projection.toSvgY(normalizedHole.tee.y)}
                r="10"
                className="hole-map__move-handle"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  startDrag(event.pointerId, { kind: "move-tee", start: normalizedHole.tee, tee: normalizedHole.tee });
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
                  startDrag(event.pointerId, { kind: "move-pin", center: normalizedHole.green_center });
                }}
              />
            ) : null}
            {selectedHazard && selectedHazardCenter ? (
              <>
                {hazardPath(selectedHazard, projection, 97) ? (
                  <path
                    d={hazardPath(selectedHazard, projection, 97)!}
                    className="hole-map__selection-outline"
                  />
                ) : null}
                {selectedHazard.shape === "corridor" && selectedHazard.width && selectedHazard.start_y != null && selectedHazard.end_y != null ? (
                  <rect
                    x={projection.toSvgX(selectedHazard.center_x - selectedHazard.width / 2)}
                    y={projection.toSvgY(selectedHazard.end_y)}
                    width={selectedHazard.width}
                    height={selectedHazard.end_y - selectedHazard.start_y}
                    className="hole-map__selection-outline-rect"
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
                      start: selectedHazardCenter,
                      hazard: selectedHazard,
                    });
                  }}
                />
                {hazardLeftHandle ? (
                  <circle
                    cx={projection.toSvgX(hazardLeftHandle.x)}
                    cy={projection.toSvgY(hazardLeftHandle.y)}
                    r="7"
                    className="hole-map__resize-handle"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      startDrag(event.pointerId, {
                        kind: "resize-hazard",
                        index: selectedHazardIndexValue ?? 0,
                        hazard: selectedHazard,
                        handle: selectedHazard.shape === "circle" ? "radius" : "left",
                      });
                    }}
                  />
                ) : null}
                {selectedHazard.shape !== "circle" && hazardRightHandle ? (
                  <circle
                    cx={projection.toSvgX(hazardRightHandle.x)}
                    cy={projection.toSvgY(hazardRightHandle.y)}
                    r="7"
                    className="hole-map__resize-handle"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      startDrag(event.pointerId, {
                        kind: "resize-hazard",
                        index: selectedHazardIndexValue ?? 0,
                        hazard: selectedHazard,
                        handle: "right",
                      });
                    }}
                  />
                ) : null}
                {selectedHazard.shape !== "circle" && hazardTopHandle ? (
                  <circle
                    cx={projection.toSvgX(hazardTopHandle.x)}
                    cy={projection.toSvgY(hazardTopHandle.y)}
                    r="7"
                    className="hole-map__resize-handle"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      startDrag(event.pointerId, {
                        kind: "resize-hazard",
                        index: selectedHazardIndexValue ?? 0,
                        hazard: selectedHazard,
                        handle: "top",
                      });
                    }}
                  />
                ) : null}
                {selectedHazard.shape !== "circle" && hazardBottomHandle ? (
                  <circle
                    cx={projection.toSvgX(hazardBottomHandle.x)}
                    cy={projection.toSvgY(hazardBottomHandle.y)}
                    r="7"
                    className="hole-map__resize-handle"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      startDrag(event.pointerId, {
                        kind: "resize-hazard",
                        index: selectedHazardIndexValue ?? 0,
                        hazard: selectedHazard,
                        handle: "bottom",
                      });
                    }}
                  />
                ) : null}
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
