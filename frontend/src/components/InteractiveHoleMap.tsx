import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, PointerEvent, WheelEvent } from "react";

import type { AimPoint, HazardData, HolePayload } from "../types";
import { createHazard, normalizeHole, syncLegacyFairwayFields } from "../lib/holeEditor";
import { EditableCourseFeature } from "./EditableCourseFeature";
import { HoleEditorTool, toolToHazardKind } from "./HoleEditorToolbar";
import { fairwayPathForRender, fairwayPathSvg, getProjection } from "./holeMapGeometry";
import { MapViewportControls } from "./MapViewportControls";

interface InteractiveHoleMapProps {
  hole: HolePayload;
  tool: HoleEditorTool;
  selectedHazardIndex: number | null;
  fitViewSignal: number;
  onChange: (hole: HolePayload) => void;
  onSelectHazard: (index: number | null) => void;
}

type DragState =
  | { kind: "green-center" }
  | { kind: "green-radius" }
  | { kind: "pin" }
  | { kind: "tee" }
  | { kind: "fairway-point"; index: number }
  | { kind: "fairway-width" }
  | { kind: "rough-width" }
  | { kind: "hazard-move"; index: number; origin: AimPoint; hazard: HazardData }
  | { kind: "hazard-resize"; index: number; hazard: HazardData }
  | { kind: "pan"; pointerId: number; svgX: number; svgY: number; startPanX: number; startPanY: number; moved: boolean };

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
  return {
    x: Number((greenCenter.x + dx * scale).toFixed(1)),
    y: Number((greenCenter.y + dy * scale).toFixed(1)),
  };
}

export function InteractiveHoleMap({
  hole,
  tool,
  selectedHazardIndex,
  fitViewSignal,
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

  function updateHole(nextHole: HolePayload) {
    onChange(normalizeHole(nextHole));
  }

  function fitToScreen() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function resetView() {
    fitToScreen();
  }

  useEffect(() => {
    fitToScreen();
  }, [fitViewSignal, normalizedHole.hole_id, normalizedHole.yardage]);

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

  function eventToHolePoint(event: PointerEvent<SVGElement> | MouseEvent<SVGSVGElement>) {
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

  function beginDrag(pointerId: number, nextState: Exclude<DragState, { kind: "pan"; pointerId: number; svgX: number; svgY: number; startPanX: number; startPanY: number; moved: boolean }>) {
    setDragState(nextState);
    svgRef.current?.setPointerCapture(pointerId);
  }

  function beginPan(pointerId: number, point: { x: number; y: number }) {
    setDragState({
      kind: "pan",
      pointerId,
      svgX: point.x,
      svgY: point.y,
      startPanX: pan.x,
      startPanY: pan.y,
      moved: false,
    });
    svgRef.current?.setPointerCapture(pointerId);
  }

  function handleCanvasClick(event: MouseEvent<SVGSVGElement>) {
    if (dragState?.kind === "pan" && dragState.moved) {
      return;
    }
    const point = eventToHolePoint(event);
    const hazardKind = toolToHazardKind(tool);

    if (hazardKind) {
      const hazards = [...normalizedHole.hazards, createHazard(hazardKind, point)];
      updateHole({ ...normalizedHole, hazards });
      onSelectHazard(hazards.length - 1);
      setSelectedFeature(null);
      return;
    }

    if (tool === "place-green") {
      const previousGreen = normalizedHole.green_center;
      const previousPin = normalizedHole.pin_position ?? previousGreen;
      const movedPin =
        Math.abs(previousPin.x - previousGreen.x) < 0.001 && Math.abs(previousPin.y - previousGreen.y) < 0.001
          ? point
          : {
              x: Number((previousPin.x + (point.x - previousGreen.x)).toFixed(1)),
              y: Number((previousPin.y + (point.y - previousGreen.y)).toFixed(1)),
            };
      updateHole({ ...normalizedHole, green_center: point, pin_position: movedPin });
      setSelectedFeature("green");
      onSelectHazard(null);
      return;
    }

    if (tool === "place-pin") {
      updateHole({
        ...normalizedHole,
        pin_position: clampPinToGreen(point, normalizedHole.green_center, normalizedHole.green_radius),
      });
      setSelectedFeature("pin");
      onSelectHazard(null);
      return;
    }

    if (tool === "place-tee") {
      updateHole({ ...normalizedHole, tee: point });
      setSelectedFeature("tee");
      onSelectHazard(null);
      return;
    }

    if (tool === "place-fairway") {
      const mid = fairwayPath[Math.floor(fairwayPath.length / 2)] ?? { x: normalizedHole.fairway_center_x, y: (normalizedHole.fairway_start_y + normalizedHole.fairway_end_y) / 2 };
      const dx = point.x - mid.x;
      const dy = point.y - mid.y;
      const nextPath = fairwayPath.map((pathPoint, index) => ({
        x: Number((pathPoint.x + dx).toFixed(1)),
        y: Number(
          clamp(
            pathPoint.y + dy,
            index === 0 ? 10 : fairwayPath[index - 1].y + 20,
            index === fairwayPath.length - 1 ? normalizedHole.yardage : fairwayPath[index + 1].y - 20,
          ).toFixed(1),
        ),
      }));
      updateHole(syncLegacyFairwayFields(normalizedHole, nextPath));
      setSelectedFeature("fairway");
      onSelectHazard(null);
      return;
    }

    if (tool === "place-rough") {
      const mid = fairwayPath[Math.floor(fairwayPath.length / 2)] ?? { x: normalizedHole.fairway_center_x, y: normalizedHole.fairway_start_y };
      const roughWidth = Math.max(6, Math.abs(point.x - mid.x) - normalizedHole.fairway_width / 2);
      updateHole({ ...normalizedHole, rough_width: Number(roughWidth.toFixed(1)) });
      setSelectedFeature("rough");
      onSelectHazard(null);
      return;
    }

    onSelectHazard(null);
    setSelectedFeature(null);
  }

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    if (tool !== "pan") {
      return;
    }
    beginPan(event.pointerId, getSvgPoint(event));
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
      const dx = point.x - dragState.svgX;
      const dy = point.y - dragState.svgY;
      setPan({
        x: Number((dragState.startPanX + dx).toFixed(2)),
        y: Number((dragState.startPanY + dy).toFixed(2)),
      });
      setDragState({ ...dragState, moved: dragState.moved || Math.abs(dx) > 2 || Math.abs(dy) > 2 });
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
              x: Number((previousPin.x + (point.x - previousGreen.x)).toFixed(1)),
              y: Number((previousPin.y + (point.y - previousGreen.y)).toFixed(1)),
            };
      updateHole({
        ...normalizedHole,
        green_center: point,
        pin_position: clampPinToGreen(movedPin, point, normalizedHole.green_radius),
      });
      setSelectedFeature("green");
      return;
    }
    if (dragState.kind === "green-radius") {
      const radius = Math.max(8, Math.hypot(point.x - normalizedHole.green_center.x, point.y - normalizedHole.green_center.y));
      updateHole({
        ...normalizedHole,
        green_radius: Number(radius.toFixed(1)),
        pin_position: clampPinToGreen(normalizedHole.pin_position ?? normalizedHole.green_center, normalizedHole.green_center, radius),
      });
      setSelectedFeature("green");
      return;
    }
    if (dragState.kind === "pin") {
      updateHole({
        ...normalizedHole,
        pin_position: clampPinToGreen(point, normalizedHole.green_center, normalizedHole.green_radius),
      });
      setSelectedFeature("pin");
      return;
    }
    if (dragState.kind === "tee") {
      updateHole({ ...normalizedHole, tee: point });
      setSelectedFeature("tee");
      return;
    }
    if (dragState.kind === "fairway-point") {
      const nextPath = fairwayPath.map((pathPoint, index) =>
        index === dragState.index
          ? {
              x: clamp(point.x, -140, 140),
              y: clamp(
                point.y,
                index === 0 ? 15 : fairwayPath[index - 1].y + 20,
                index === fairwayPath.length - 1 ? normalizedHole.yardage : fairwayPath[index + 1].y - 20,
              ),
            }
          : pathPoint,
      );
      updateHole(syncLegacyFairwayFields(normalizedHole, nextPath));
      setSelectedFeature("fairway");
      return;
    }
    if (dragState.kind === "fairway-width") {
      const mid = fairwayPath[Math.floor(fairwayPath.length / 2)];
      const width = Math.max(12, Math.abs(point.x - mid.x) * 2);
      updateHole({ ...normalizedHole, fairway_width: Number(width.toFixed(1)) });
      setSelectedFeature("fairway");
      return;
    }
    if (dragState.kind === "rough-width") {
      const mid = fairwayPath[Math.floor(fairwayPath.length / 2)];
      const totalHalf = Math.max(normalizedHole.fairway_width / 2 + 4, Math.abs(point.x - mid.x));
      const roughWidth = Math.max(6, totalHalf - normalizedHole.fairway_width / 2);
      updateHole({ ...normalizedHole, rough_width: Number(roughWidth.toFixed(1)) });
      setSelectedFeature("rough");
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
      onSelectHazard(dragState.index);
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
      });
      updateHole({ ...normalizedHole, hazards });
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

  const pin = normalizedHole.pin_position ?? normalizedHole.green_center;
  const midPoint =
    fairwayPath[Math.floor(fairwayPath.length / 2)] ?? { x: normalizedHole.fairway_center_x, y: normalizedHole.fairway_start_y };
  const fairwayWidthHandle = {
    x: midPoint.x + normalizedHole.fairway_width / 2,
    y: midPoint.y,
  };
  const roughWidthHandle = {
    x: midPoint.x + normalizedHole.fairway_width / 2 + normalizedHole.rough_width,
    y: midPoint.y,
  };

  const fairwaySelected = selectedFeature === "fairway" || tool === "place-fairway";
  const roughSelected = selectedFeature === "rough" || tool === "place-rough";
  const greenSelected = selectedFeature === "green" || tool === "place-green";
  const pinSelected = selectedFeature === "pin" || tool === "place-pin";
  const teeSelected = selectedFeature === "tee" || tool === "place-tee";

  return (
    <section className="card map-card">
      <div className="card__header">
        <div>
          <p className="eyebrow">Designer</p>
          <h2>Interactive Hole Editor</h2>
          <p className="map-subtitle">
            Use the toolbar to place components, drag features directly, and zoom or pan without losing the full hole.
          </p>
        </div>
      </div>

      <MapViewportControls
        zoomLabel={`${Math.round(zoom * 100)}%`}
        onZoomIn={() => zoomAround(1.2)}
        onZoomOut={() => zoomAround(1 / 1.2)}
        onFit={fitToScreen}
        onReset={resetView}
      />

      <div className="hole-map-stage hole-map-stage--editor">
        <svg
          ref={svgRef}
          className={`hole-map hole-map--interactive ${tool === "pan" ? "hole-map--pannable" : ""}`}
          viewBox={`0 0 ${projection.width} ${projection.height}`}
          onClick={handleCanvasClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onWheel={handleWheel}
        >
          <rect x="0" y="0" width={projection.width} height={projection.height} rx="20" className="hole-map__base" />
          <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
            <path
              d={fairwayLine}
              className={`hole-map__rough-path ${roughSelected ? "hole-map__path--selected" : ""}`}
              strokeWidth={normalizedHole.fairway_width + normalizedHole.rough_width * 2}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedFeature("rough");
                onSelectHazard(null);
              }}
            />
            <path
              d={fairwayLine}
              className={`hole-map__fairway-path ${fairwaySelected ? "hole-map__path--selected" : ""}`}
              strokeWidth={normalizedHole.fairway_width}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedFeature("fairway");
                onSelectHazard(null);
              }}
            />

            <circle
              cx={projection.toSvgX(normalizedHole.green_center.x)}
              cy={projection.toSvgY(normalizedHole.green_center.y)}
              r={normalizedHole.green_radius}
              className={`hole-map__green ${greenSelected ? "hole-map__green--selected" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedFeature("green");
                onSelectHazard(null);
              }}
              onPointerDown={(event) => {
                if (tool === "pan") {
                  return;
                }
                event.stopPropagation();
                beginDrag(event.pointerId, { kind: "green-center" });
              }}
            />
            <circle
              cx={projection.toSvgX(normalizedHole.tee.x)}
              cy={projection.toSvgY(normalizedHole.tee.y)}
              r="5"
              className={`hole-map__tee ${teeSelected ? "hole-map__tee--selected" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedFeature("tee");
                onSelectHazard(null);
              }}
              onPointerDown={(event) => {
                if (tool === "pan") {
                  return;
                }
                event.stopPropagation();
                beginDrag(event.pointerId, { kind: "tee" });
              }}
            />

            {normalizedHole.hazards.map((hazard, index) => {
              const isSelected = selectedHazardIndex === index;
              const fill =
                hazard.kind === "ob" ? "#d95c54" : hazard.kind === "water" ? "#4e9cc7" : hazard.kind === "recovery" ? "#857056" : "#d9bd7f";
              const commonProps = {
                onClick: (event: MouseEvent<SVGElement>) => {
                  event.stopPropagation();
                  onSelectHazard(index);
                  setSelectedFeature(null);
                },
                onPointerDown: (event: PointerEvent<SVGElement>) => {
                  if (tool === "pan") {
                    return;
                  }
                  event.stopPropagation();
                  onSelectHazard(index);
                  setSelectedFeature(null);
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
                      fill={fill}
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
                      fill={fill}
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
                      fill={fill}
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
                selected={fairwaySelected}
                onPointerDown={(pointerId) => beginDrag(pointerId, { kind: "fairway-point", index })}
              />
            ))}
            <EditableCourseFeature
              x={projection.toSvgX(fairwayWidthHandle.x)}
              y={projection.toSvgY(fairwayWidthHandle.y)}
              label="Fairway width"
              selected={fairwaySelected}
              onPointerDown={(pointerId) => beginDrag(pointerId, { kind: "fairway-width" })}
            />
            <EditableCourseFeature
              x={projection.toSvgX(roughWidthHandle.x)}
              y={projection.toSvgY(roughWidthHandle.y)}
              label="Rough width"
              selected={roughSelected}
              onPointerDown={(pointerId) => beginDrag(pointerId, { kind: "rough-width" })}
            />
            <EditableCourseFeature
              x={projection.toSvgX(normalizedHole.green_center.x)}
              y={projection.toSvgY(normalizedHole.green_center.y)}
              label="Green"
              selected={greenSelected}
              onPointerDown={(pointerId) => beginDrag(pointerId, { kind: "green-center" })}
            />
            <EditableCourseFeature
              x={projection.toSvgX(normalizedHole.green_center.x + normalizedHole.green_radius)}
              y={projection.toSvgY(normalizedHole.green_center.y)}
              label="Green size"
              selected={greenSelected}
              onPointerDown={(pointerId) => beginDrag(pointerId, { kind: "green-radius" })}
            />
            <EditableCourseFeature
              x={projection.toSvgX(pin.x)}
              y={projection.toSvgY(pin.y)}
              label="Pin"
              selected={pinSelected}
              onPointerDown={(pointerId) => beginDrag(pointerId, { kind: "pin" })}
            />
            <EditableCourseFeature
              x={projection.toSvgX(normalizedHole.tee.x)}
              y={projection.toSvgY(normalizedHole.tee.y)}
              label="Tee"
              selected={teeSelected}
              onPointerDown={(pointerId) => beginDrag(pointerId, { kind: "tee" })}
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
