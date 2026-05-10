import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, PointerEvent, WheelEvent } from "react";

import type { AimPoint, HazardData, HolePayload } from "../types";
import { createHazard, normalizeHole, syncLegacyFairwayFields } from "../lib/holeEditor";
import { HoleEditorTool, toolToHazardKind } from "./HoleEditorToolbar";
import { fairwayPathForRender, fairwayPathSvg, getProjection } from "./holeMapGeometry";
import { flagPath, hazardPath, organicBlobPath, teeBoxPath } from "./holeVisuals";
import { MapViewportControls } from "./MapViewportControls";

interface InteractiveHoleMapProps {
  hole: HolePayload;
  tool: HoleEditorTool;
  selectedHazardIndex: number | null;
  fitViewSignal: number;
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
  | { kind: "resize-hazard"; index: number; hazard: HazardData }
  | { kind: "pan"; pointerId: number; svgX: number; svgY: number; startPanX: number; startPanY: number };

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

function isNearGreenEdge(point: AimPoint, greenCenter: AimPoint, greenRadius: number): boolean {
  const distance = Math.hypot(point.x - greenCenter.x, point.y - greenCenter.y);
  return distance >= Math.max(5, greenRadius * 0.68);
}

function isNearHazardEdge(point: AimPoint, hazard: HazardData): boolean {
  if (hazard.shape === "circle" && hazard.radius) {
    const distance = Math.hypot(point.x - hazard.center_x, point.y - hazard.center_y);
    return Math.abs(distance - hazard.radius) <= Math.max(4, hazard.radius * 0.35);
  }

  if (hazard.shape === "rectangle" && hazard.width && hazard.depth) {
    const dx = Math.abs(point.x - hazard.center_x);
    const dy = Math.abs(point.y - hazard.center_y);
    const halfWidth = hazard.width / 2;
    const halfDepth = hazard.depth / 2;
    return dx >= halfWidth - 4 || dy >= halfDepth - 4;
  }

  if (hazard.shape === "corridor" && hazard.width && hazard.start_y != null && hazard.end_y != null) {
    const dx = Math.abs(point.x - hazard.center_x);
    const halfWidth = hazard.width / 2;
    const topGap = Math.abs(point.y - hazard.start_y);
    const bottomGap = Math.abs(point.y - hazard.end_y);
    return dx >= halfWidth - 4 || topGap <= 6 || bottomGap <= 6;
  }

  return false;
}

export function InteractiveHoleMap({
  hole,
  tool,
  selectedHazardIndex,
  fitViewSignal,
  onBeginEdit,
  onChange,
  onSelectHazard,
}: InteractiveHoleMapProps) {
  const normalizedHole = normalizeHole(hole);
  const fairwayPath = fairwayPathForRender(normalizedHole);
  const projection = useMemo(() => getProjection(normalizedHole), [normalizedHole]);
  const fairwayLine = fairwayPathSvg(fairwayPath, projection);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedFeature, setSelectedFeature] = useState<"fairway" | "green" | "rough" | "pin" | "tee" | null>(null);
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

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [fitViewSignal, normalizedHole.hole_id, normalizedHole.yardage]);

  function updateHole(nextHole: HolePayload) {
    onChange(normalizeHole(nextHole));
  }

  function getSvgPoint(event: MouseEvent<SVGSVGElement> | PointerEvent<SVGElement> | WheelEvent<SVGSVGElement>) {
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
    return projection.toHolePoint((svgX - pan.x) / zoom, (svgY - pan.y) / zoom);
  }

  function holePointFromEvent(event: PointerEvent<SVGElement> | MouseEvent<SVGSVGElement>) {
    const point = getSvgPoint(event);
    return roundPoint(toHolePoint(point.x, point.y));
  }

  function zoomAround(factor: number, anchor?: { x: number; y: number }) {
    const nextZoom = clamp(Number((zoom * factor).toFixed(3)), 1, 4.5);
    const focal = anchor ?? { x: projection.width / 2, y: projection.height / 2 };
    setPan((current) => ({
      x: Number((focal.x - ((focal.x - current.x) / zoom) * nextZoom).toFixed(2)),
      y: Number((focal.y - ((focal.y - current.y) / zoom) * nextZoom).toFixed(2)),
    }));
    setZoom(nextZoom);
  }

  function fitToScreen() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function startDrag(
    pointerId: number,
    nextDragState: Exclude<DragState, { kind: "pan"; pointerId: number; svgX: number; svgY: number; startPanX: number; startPanY: number }>,
  ) {
    onBeginEdit(normalizedHole);
    setDragState(nextDragState);
    svgRef.current?.setPointerCapture(pointerId);
  }

  function startResizeOrMove(event: PointerEvent<SVGElement>, moveState: Exclude<DragState, { kind: "pan"; pointerId: number; svgX: number; svgY: number; startPanX: number; startPanY: number }>, resizeState?: Exclude<DragState, { kind: "pan"; pointerId: number; svgX: number; svgY: number; startPanX: number; startPanY: number }>) {
    if (tool === "delete") {
      return;
    }
    event.stopPropagation();
    if (tool === "resize" && resizeState) {
      startDrag(event.pointerId, resizeState);
      return;
    }
    startDrag(event.pointerId, moveState);
  }

  function handleCanvasClick(event: MouseEvent<SVGSVGElement>) {
    if (dragState?.kind === "pan") {
      return;
    }
    const point = holePointFromEvent(event);
    const hazardKind = toolToHazardKind(tool);

    if (hazardKind) {
      onBeginEdit(normalizedHole);
      const hazards = [...normalizedHole.hazards, createHazard(hazardKind, point)];
      updateHole({ ...normalizedHole, hazards });
      onSelectHazard(hazards.length - 1);
      setSelectedFeature(null);
      return;
    }

    onSelectHazard(null);
    setSelectedFeature(null);
  }

  function handleSvgPointerDown(event: PointerEvent<SVGSVGElement>) {
    if (tool !== "pan") {
      return;
    }
    const point = getSvgPoint(event);
    setDragState({
      kind: "pan",
      pointerId: event.pointerId,
      svgX: point.x,
      svgY: point.y,
      startPanX: pan.x,
      startPanY: pan.y,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!dragState) {
      return;
    }
    if (dragState.kind === "pan") {
      if (dragState.pointerId !== event.pointerId) {
        return;
      }
      const point = getSvgPoint(event);
      setPan({
        x: Number((dragState.startPanX + point.x - dragState.svgX).toFixed(2)),
        y: Number((dragState.startPanY + point.y - dragState.svgY).toFixed(2)),
      });
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
      setSelectedFeature("green");
      return;
    }
    if (dragState.kind === "resize-green") {
      const radius = Number(Math.max(8, Math.hypot(point.x - normalizedHole.green_center.x, point.y - normalizedHole.green_center.y)).toFixed(1));
      updateHole({
        ...normalizedHole,
        green_radius: radius,
        pin_position: clampPinToGreen(pin, normalizedHole.green_center, radius),
      });
      setSelectedFeature("green");
      return;
    }
    if (dragState.kind === "move-pin") {
      updateHole({
        ...normalizedHole,
        pin_position: clampPinToGreen(point, normalizedHole.green_center, normalizedHole.green_radius),
      });
      setSelectedFeature("pin");
      return;
    }
    if (dragState.kind === "move-tee") {
      updateHole({ ...normalizedHole, tee: point });
      setSelectedFeature("tee");
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
      setSelectedFeature("fairway");
      return;
    }
    if (dragState.kind === "resize-fairway-width") {
      const centerX = fairwayCenterAtY(fairwayPath, point.y);
      updateHole({ ...normalizedHole, fairway_width: Number(Math.max(12, Math.abs(point.x - centerX) * 2).toFixed(1)) });
      setSelectedFeature("fairway");
      return;
    }
    if (dragState.kind === "resize-rough-width") {
      const centerX = fairwayCenterAtY(fairwayPath, point.y);
      const totalHalf = Math.max(normalizedHole.fairway_width / 2 + 4, Math.abs(point.x - centerX));
      updateHole({ ...normalizedHole, rough_width: Number(Math.max(6, totalHalf - normalizedHole.fairway_width / 2).toFixed(1)) });
      setSelectedFeature("rough");
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
    }
  }

  function handlePointerUp(event: PointerEvent<SVGSVGElement>) {
    if (dragState) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragState(null);
  }

  function handleWheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    zoomAround(event.deltaY < 0 ? 1.12 : 1 / 1.12, getSvgPoint(event));
  }

  const midPoint = fairwayPath[Math.floor(fairwayPath.length / 2)] ?? { x: normalizedHole.fairway_center_x, y: normalizedHole.fairway_start_y };
  const fairwayWidthHandle = { x: midPoint.x + normalizedHole.fairway_width / 2, y: midPoint.y };
  const roughWidthHandle = { x: midPoint.x + normalizedHole.fairway_width / 2 + normalizedHole.rough_width, y: midPoint.y };

  const fairwaySelected = selectedFeature === "fairway";
  const roughSelected = selectedFeature === "rough";
  const greenSelected = selectedFeature === "green";
  const teeSelected = selectedFeature === "tee";

  function maybeDeleteHazard(index: number) {
    if (tool !== "delete") {
      return false;
    }
    updateHole({
      ...normalizedHole,
      hazards: normalizedHole.hazards.filter((_, rowIndex) => rowIndex !== index),
    });
    onSelectHazard(null);
    return true;
  }

  return (
    <section className="card map-card">
      <div className="card__header">
        <div>
          <p className="eyebrow">Designer</p>
          <h2>Interactive Hole Editor</h2>
          <p className="map-subtitle">
            Pick a mode, then click and drag directly on the course to move or resize major features.
          </p>
        </div>
      </div>

      <MapViewportControls
        zoomLabel={`${Math.round(zoom * 100)}%`}
        panEnabled={tool === "pan"}
        onTogglePan={undefined}
        onZoomIn={() => zoomAround(1.2)}
        onZoomOut={() => zoomAround(1 / 1.2)}
        onFit={fitToScreen}
        onReset={fitToScreen}
      />

      <div className="hole-map-stage hole-map-stage--editor">
        <svg
          ref={svgRef}
          className={`hole-map hole-map--interactive ${tool === "pan" ? "hole-map--pannable" : ""}`}
          viewBox={`0 0 ${projection.width} ${projection.height}`}
          onClick={handleCanvasClick}
          onPointerDown={handleSvgPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onWheel={handleWheel}
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
          <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
            <path
              d={fairwayLine}
              className={`hole-map__rough-path ${roughSelected ? "hole-map__path--selected" : ""}`}
              strokeWidth={normalizedHole.fairway_width + normalizedHole.rough_width * 2}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedFeature("rough");
              }}
              onPointerDown={(event) =>
                startResizeOrMove(event, { kind: "move-fairway", origin: holePointFromEvent(event), path: fairwayPath }, {
                  kind:
                    Math.abs(
                      holePointFromEvent(event).x - fairwayCenterAtY(fairwayPath, holePointFromEvent(event).y),
                    ) >=
                    normalizedHole.fairway_width / 2 + normalizedHole.rough_width * 0.45
                      ? "resize-rough-width"
                      : "move-fairway",
                } as DragState)
              }
            />
            <path d={fairwayLine} className="hole-map__fairway-shadow" strokeWidth={normalizedHole.fairway_width + 5} />
            <path
              d={fairwayLine}
              className={`hole-map__fairway-path ${fairwaySelected ? "hole-map__path--selected" : ""}`}
              strokeWidth={normalizedHole.fairway_width}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedFeature("fairway");
              }}
              onPointerDown={(event) =>
                startResizeOrMove(event, { kind: "move-fairway", origin: holePointFromEvent(event), path: fairwayPath }, {
                  kind:
                    Math.abs(
                      holePointFromEvent(event).x - fairwayCenterAtY(fairwayPath, holePointFromEvent(event).y),
                    ) >=
                    normalizedHole.fairway_width / 2 - 4
                      ? "resize-fairway-width"
                      : "move-fairway",
                } as DragState)
              }
            />
            <path d={fairwayLine} className="hole-map__fairway-centerline" strokeWidth={1.6} />
            <line
              x1={projection.toSvgX(fairwayWidthHandle.x)}
              y1={projection.toSvgY(fairwayWidthHandle.y + 10)}
              x2={projection.toSvgX(fairwayWidthHandle.x)}
              y2={projection.toSvgY(fairwayWidthHandle.y - 10)}
              className={`hole-map__edge-grip ${fairwaySelected ? "hole-map__edge-grip--active" : ""}`}
              onPointerDown={(event) => startDrag(event.pointerId, { kind: "resize-fairway-width" })}
            />
            <line
              x1={projection.toSvgX(roughWidthHandle.x)}
              y1={projection.toSvgY(roughWidthHandle.y + 10)}
              x2={projection.toSvgX(roughWidthHandle.x)}
              y2={projection.toSvgY(roughWidthHandle.y - 10)}
              className={`hole-map__edge-grip ${roughSelected ? "hole-map__edge-grip--active" : ""}`}
              onPointerDown={(event) => startDrag(event.pointerId, { kind: "resize-rough-width" })}
            />

            <path
              d={greenPath}
              className={`hole-map__green ${greenSelected ? "hole-map__green--selected" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedFeature("green");
                onSelectHazard(null);
              }}
              onPointerDown={(event) =>
                startResizeOrMove(
                  event,
                  { kind: "move-green" },
                  isNearGreenEdge(holePointFromEvent(event), normalizedHole.green_center, normalizedHole.green_radius)
                    ? { kind: "resize-green" }
                    : undefined,
                )
              }
            />
            <path d={greenInnerPath} className="hole-map__green-inner" />
            {greenSelected ? <path d={greenPath} className="hole-map__selection-outline" /> : null}

            <path
              d={teePath}
              className={`hole-map__tee-box ${teeSelected ? "hole-map__tee-box--selected" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedFeature("tee");
              }}
              onPointerDown={(event) => startResizeOrMove(event, { kind: "move-tee" })}
            />

            {normalizedHole.hazards.map((hazard, index) => {
              const organicPath = hazardPath(hazard, projection, index + 3);
              const commonClick = (event: MouseEvent<SVGElement>) => {
                event.stopPropagation();
                if (maybeDeleteHazard(index)) {
                  return;
                }
                onSelectHazard(index);
                setSelectedFeature(null);
              };
              const commonPointerDown = (event: PointerEvent<SVGElement>) => {
                startResizeOrMove(
                  event,
                  { kind: "move-hazard", index, origin: holePointFromEvent(event), hazard },
                  isNearHazardEdge(holePointFromEvent(event), hazard)
                    ? { kind: "resize-hazard", index, hazard }
                    : undefined,
                );
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
                setSelectedFeature("pin");
              }}
              onPointerDown={(event) => startResizeOrMove(event, { kind: "move-pin" })}
            />
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
