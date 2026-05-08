import { useRef, useState } from "react";
import type { MouseEvent, PointerEvent, WheelEvent } from "react";

import type { AimPoint, HolePayload, ShotSample } from "../types";
import { fairwayPathForRender, fairwayPathSvg, getProjection } from "./holeMapGeometry";
import { hazardPath, flagPath, organicBlobPath, teeBoxPath } from "./holeVisuals";
import { MapViewportControls } from "./MapViewportControls";

interface HoleMapProps {
  hole: HolePayload;
  title?: string;
  subtitle?: string;
  startPosition?: AimPoint;
  targetPosition?: AimPoint;
  aimPoint?: AimPoint;
  shotSamples?: ShotSample[];
  onMapClick?: (point: AimPoint) => void;
  interactionHint?: string;
}

const SURFACE_COLORS: Record<string, string> = {
  bunker: "#dfc286",
  water: "#58a8cf",
  ob: "#dc655a",
  recovery: "#8a7657",
};

function surfaceColor(kind: string): string {
  return SURFACE_COLORS[kind] ?? "#88b267";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function HoleMap({
  hole,
  title = "Hole preview",
  subtitle,
  startPosition,
  targetPosition,
  aimPoint,
  shotSamples = [],
  onMapClick,
  interactionHint,
}: HoleMapProps) {
  const fairwayPath = fairwayPathForRender(hole);
  const projection = getProjection(hole, {
    shotPoints: shotSamples,
    keyPoints: [
      ...(startPosition ? [startPosition] : []),
      ...(targetPosition ? [targetPosition] : []),
      ...(aimPoint ? [aimPoint] : []),
    ],
  });
  const fairwayLine = fairwayPathSvg(fairwayPath, projection);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panEnabled, setPanEnabled] = useState(false);
  const panDragRef = useRef<{
    pointerId: number;
    svgX: number;
    svgY: number;
    startPanX: number;
    startPanY: number;
    moved: boolean;
  } | null>(null);

  const pinPosition = hole.pin_position ?? hole.green_center;
  const flag = flagPath(pinPosition, projection);
  const greenPath = organicBlobPath(
    hole.green_center,
    hole.green_radius * 1.12,
    hole.green_radius * 0.92,
    projection,
    11,
  );
  const greenInnerPath = organicBlobPath(
    hole.green_center,
    hole.green_radius * 0.72,
    hole.green_radius * 0.58,
    projection,
    19,
  );
  const teePath = teeBoxPath(hole.tee, projection);

  function getSvgPoint(event: MouseEvent<SVGSVGElement> | PointerEvent<SVGSVGElement> | WheelEvent<SVGSVGElement>) {
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

  function resetView() {
    fitToScreen();
    setPanEnabled(false);
  }

  function handleSvgClick(event: MouseEvent<SVGSVGElement>) {
    if (!onMapClick || panDragRef.current?.moved) {
      return;
    }
    const { x, y } = getSvgPoint(event);
    onMapClick(toHolePoint(x, y));
  }

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    if (!panEnabled) {
      return;
    }
    const point = getSvgPoint(event);
    panDragRef.current = {
      pointerId: event.pointerId,
      svgX: point.x,
      svgY: point.y,
      startPanX: pan.x,
      startPanY: pan.y,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const drag = panDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const point = getSvgPoint(event);
    const dx = point.x - drag.svgX;
    const dy = point.y - drag.svgY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      drag.moved = true;
    }
    setPan({
      x: Number((drag.startPanX + dx).toFixed(2)),
      y: Number((drag.startPanY + dy).toFixed(2)),
    });
  }

  function handlePointerUp(event: PointerEvent<SVGSVGElement>) {
    if (panDragRef.current?.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      panDragRef.current = null;
    }
  }

  function handleWheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    zoomAround(event.deltaY < 0 ? 1.12 : 1 / 1.12, getSvgPoint(event));
  }

  return (
    <section className="card map-card">
      <div className="card__header">
        <div>
          <p className="eyebrow">Visualization</p>
          <h2>{title}</h2>
          {subtitle ? <p className="map-subtitle">{subtitle}</p> : null}
          {interactionHint ? <p className="map-hint">{interactionHint}</p> : null}
        </div>
        <div className="map-yardage">{Math.round(hole.yardage)}y</div>
      </div>

      <MapViewportControls
        zoomLabel={`${Math.round(zoom * 100)}%`}
        panEnabled={panEnabled}
        onTogglePan={() => setPanEnabled((current) => !current)}
        onZoomIn={() => zoomAround(1.2)}
        onZoomOut={() => zoomAround(1 / 1.2)}
        onFit={fitToScreen}
        onReset={resetView}
      />

      <div className="hole-map-stage">
        <svg
          ref={svgRef}
          className={`hole-map ${onMapClick ? "hole-map--interactive" : ""} ${panEnabled ? "hole-map--pannable" : ""}`}
          viewBox={`0 0 ${projection.width} ${projection.height}`}
          role="img"
          aria-label={title}
          onClick={handleSvgClick}
          onPointerDown={handlePointerDown}
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
            <linearGradient id="sandFill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ecd6a8" />
              <stop offset="100%" stopColor="#d7b77b" />
            </linearGradient>
            <linearGradient id="waterFill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#74c1e4" />
              <stop offset="100%" stopColor="#3b8ebf" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width={projection.width} height={projection.height} rx="22" className="hole-map__base" />
          <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
            <path d={fairwayLine} className="hole-map__rough-path" strokeWidth={hole.fairway_width + hole.rough_width * 2} />
            <path d={fairwayLine} className="hole-map__fairway-shadow" strokeWidth={hole.fairway_width + 5} />
            <path d={fairwayLine} className="hole-map__fairway-path" strokeWidth={hole.fairway_width} />
            <path d={fairwayLine} className="hole-map__fairway-centerline" strokeWidth={1.6} />

            <path d={greenPath} className="hole-map__green" />
            <path d={greenInnerPath} className="hole-map__green-inner" />
            <path d={teePath} className="hole-map__tee-box" />

            {hole.hazards.map((hazard, index) => {
              const organicPath = hazardPath(hazard, projection, index + 3);
              if (organicPath) {
                return (
                  <path
                    key={`${hazard.kind}-${index}`}
                    d={organicPath}
                    className={`hole-map__hazard-fill hole-map__hazard-fill--${hazard.kind}`}
                    fill={hazard.kind === "water" ? "url(#waterFill)" : hazard.kind === "bunker" ? "url(#sandFill)" : surfaceColor(hazard.kind)}
                  />
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
                      className="hole-map__ob-corridor"
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

            {startPosition && targetPosition ? (
              <line
                x1={projection.toSvgX(startPosition.x)}
                y1={projection.toSvgY(startPosition.y)}
                x2={projection.toSvgX(targetPosition.x)}
                y2={projection.toSvgY(targetPosition.y)}
                className="hole-map__line hole-map__line--target"
              />
            ) : null}

            {startPosition && aimPoint ? (
              <line
                x1={projection.toSvgX(startPosition.x)}
                y1={projection.toSvgY(startPosition.y)}
                x2={projection.toSvgX(aimPoint.x)}
                y2={projection.toSvgY(aimPoint.y)}
                className="hole-map__line hole-map__line--aim"
              />
            ) : null}

            {shotSamples.map((sample, index) => (
              <circle
                key={`${sample.x}-${sample.y}-${index}`}
                cx={projection.toSvgX(sample.x)}
                cy={projection.toSvgY(sample.y)}
                r="2.8"
                className={`hole-map__sample hole-map__sample--${sample.surface}`}
              />
            ))}

            {startPosition ? (
              <>
                <circle
                  cx={projection.toSvgX(startPosition.x)}
                  cy={projection.toSvgY(startPosition.y)}
                  r="5.8"
                  className="hole-map__start-point"
                />
                <circle
                  cx={projection.toSvgX(startPosition.x)}
                  cy={projection.toSvgY(startPosition.y)}
                  r="8.6"
                  className="hole-map__start-ring"
                />
                <text
                  x={projection.toSvgX(startPosition.x) + 10}
                  y={projection.toSvgY(startPosition.y) - 9}
                  className="hole-map__label"
                >
                  Ball
                </text>
              </>
            ) : null}

            {aimPoint ? (
              <circle
                cx={projection.toSvgX(aimPoint.x)}
                cy={projection.toSvgY(aimPoint.y)}
                r="5.5"
                className="hole-map__aim-point"
              />
            ) : null}

            {targetPosition ? (
              <>
                <circle
                  cx={projection.toSvgX(targetPosition.x)}
                  cy={projection.toSvgY(targetPosition.y)}
                  r="4.2"
                  className="hole-map__target-point"
                />
                <text
                  x={projection.toSvgX(targetPosition.x) + 10}
                  y={projection.toSvgY(targetPosition.y) - 9}
                  className="hole-map__label"
                >
                  Target
                </text>
              </>
            ) : null}

            <path d={flag.pole} className="hole-map__pin-pole" />
            <path d={flag.flag} className="hole-map__pin-flag" />
            <circle
              cx={projection.toSvgX(pinPosition.x)}
              cy={projection.toSvgY(pinPosition.y)}
              r="3.5"
              className="hole-map__pin-point"
            />

            <text x={projection.toSvgX(hole.tee.x) + 10} y={projection.toSvgY(hole.tee.y) - 10} className="hole-map__label">
              Tee
            </text>
            <text
              x={projection.toSvgX(hole.green_center.x) + hole.green_radius + 8}
              y={projection.toSvgY(hole.green_center.y)}
              className="hole-map__label"
            >
              Green
            </text>
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
        {startPosition ? <span><i className="legend-swatch legend-swatch--ball" /> Ball</span> : null}
        {aimPoint ? <span><i className="legend-swatch legend-swatch--aim" /> Recommended aim</span> : null}
        <span><i className="legend-swatch legend-swatch--pin" /> Pin</span>
      </div>
    </section>
  );
}
