import type { MouseEvent } from "react";

import type { AimPoint, HolePayload, ShotSample } from "../types";
import { fairwayPathForRender, fairwayPathSvg, getProjection } from "./holeMapGeometry";

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
  bunker: "#e6c98c",
  water: "#69a9d6",
  ob: "#d9534f",
  recovery: "#8d6a4d",
};

function surfaceColor(kind: string): string {
  return SURFACE_COLORS[kind] ?? "#86ab6d";
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

  function handleSvgClick(event: MouseEvent<SVGSVGElement>) {
    if (!onMapClick) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * projection.width;
    const svgY = ((event.clientY - rect.top) / rect.height) * projection.height;
    onMapClick(projection.toHolePoint(svgX, svgY));
  }

  const pinPosition = hole.pin_position ?? hole.green_center;

  return (
    <section className="card">
      <div className="card__header">
        <div>
          <p className="eyebrow">Visualization</p>
          <h2>{title}</h2>
          {subtitle ? <p className="map-subtitle">{subtitle}</p> : null}
          {interactionHint ? <p className="map-hint">{interactionHint}</p> : null}
        </div>
        <div className="map-yardage">{Math.round(hole.yardage)}y</div>
      </div>

      <svg
        className={`hole-map ${onMapClick ? "hole-map--interactive" : ""}`}
        viewBox={`0 0 ${projection.width} ${projection.height}`}
        role="img"
        aria-label={title}
        onClick={handleSvgClick}
      >
        <rect x="0" y="0" width={projection.width} height={projection.height} rx="20" className="hole-map__base" />

        <path d={fairwayLine} className="hole-map__rough-path" strokeWidth={hole.fairway_width + hole.rough_width * 2} />
        <path d={fairwayLine} className="hole-map__fairway-path" strokeWidth={hole.fairway_width} />
        <circle
          cx={projection.toSvgX(hole.green_center.x)}
          cy={projection.toSvgY(hole.green_center.y)}
          r={hole.green_radius}
          className="hole-map__green"
        />
        <circle
          cx={projection.toSvgX(hole.tee.x)}
          cy={projection.toSvgY(hole.tee.y)}
          r="5"
          className="hole-map__tee"
        />

        {hole.hazards.map((hazard, index) => {
          if (hazard.shape === "circle" && hazard.radius) {
            return (
              <circle
                key={`${hazard.kind}-${index}`}
                cx={projection.toSvgX(hazard.center_x)}
                cy={projection.toSvgY(hazard.center_y)}
                r={hazard.radius}
                fill={surfaceColor(hazard.kind)}
                opacity="0.88"
              />
            );
          }
          if (hazard.shape === "rectangle" && hazard.width && hazard.depth) {
            return (
              <rect
                key={`${hazard.kind}-${index}`}
                x={projection.toSvgX(hazard.center_x - hazard.width / 2)}
                y={projection.toSvgY(hazard.center_y + hazard.depth / 2)}
                width={hazard.width}
                height={hazard.depth}
                fill={surfaceColor(hazard.kind)}
                opacity="0.88"
                rx="8"
              />
            );
          }
          if (hazard.shape === "corridor" && hazard.width && hazard.start_y != null && hazard.end_y != null) {
            return (
              <rect
                key={`${hazard.kind}-${index}`}
                x={projection.toSvgX(hazard.center_x - hazard.width / 2)}
                y={projection.toSvgY(hazard.end_y)}
                width={hazard.width}
                height={hazard.end_y - hazard.start_y}
                fill={surfaceColor(hazard.kind)}
                opacity="0.65"
                rx="8"
              />
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
              r="5.4"
              className="hole-map__start-point"
            />
            <text
              x={projection.toSvgX(startPosition.x) + 8}
              y={projection.toSvgY(startPosition.y) - 8}
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
              x={projection.toSvgX(targetPosition.x) + 8}
              y={projection.toSvgY(targetPosition.y) - 8}
              className="hole-map__label"
            >
              Target
            </text>
          </>
        ) : null}

        <text x={projection.toSvgX(hole.tee.x) + 8} y={projection.toSvgY(hole.tee.y) - 8} className="hole-map__label">
          Tee
        </text>
        <text
          x={projection.toSvgX(hole.green_center.x) + hole.green_radius + 6}
          y={projection.toSvgY(hole.green_center.y)}
          className="hole-map__label"
        >
          Green
        </text>
        <text x={projection.toSvgX(pinPosition.x) + 8} y={projection.toSvgY(pinPosition.y) + 14} className="hole-map__label">
          Pin
        </text>
      </svg>

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
