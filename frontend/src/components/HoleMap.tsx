import type { AimPoint, HolePayload, ShotSample } from "../types";

interface HoleMapProps {
  hole: HolePayload;
  title?: string;
  subtitle?: string;
  startPosition?: AimPoint;
  targetPosition?: AimPoint;
  aimPoint?: AimPoint;
  shotSamples?: ShotSample[];
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
}: HoleMapProps) {
  const xs = [
    hole.tee.x,
    hole.green_center.x,
    hole.fairway_center_x - hole.fairway_width / 2 - hole.rough_width,
    hole.fairway_center_x + hole.fairway_width / 2 + hole.rough_width,
    ...hole.hazards.flatMap((hazard) => [
      hazard.x_min ?? hazard.center_x - (hazard.width ?? hazard.radius ?? 0),
      hazard.x_max ?? hazard.center_x + (hazard.width ?? hazard.radius ?? 0),
    ]),
    ...shotSamples.map((sample) => sample.x),
    ...(startPosition ? [startPosition.x] : []),
    ...(targetPosition ? [targetPosition.x] : []),
    ...(aimPoint ? [aimPoint.x] : []),
  ];
  const ys = [
    0,
    hole.tee.y,
    hole.green_center.y + hole.green_radius + 15,
    hole.fairway_end_y,
    ...hole.hazards.flatMap((hazard) => [
      hazard.y_min ?? hazard.center_y - (hazard.depth ?? hazard.radius ?? 0),
      hazard.y_max ?? hazard.center_y + (hazard.depth ?? hazard.radius ?? 0),
    ]),
    ...shotSamples.map((sample) => sample.y),
    ...(startPosition ? [startPosition.y] : []),
    ...(targetPosition ? [targetPosition.y] : []),
    ...(aimPoint ? [aimPoint.y] : []),
  ];

  const padding = 18;
  const minX = Math.min(...xs) - padding;
  const maxX = Math.max(...xs) + padding;
  const minY = Math.min(...ys) - padding;
  const maxY = Math.max(...ys) + padding;
  const width = Math.max(maxX - minX, 120);
  const height = Math.max(maxY - minY, 220);

  const toSvgX = (x: number) => x - minX;
  const toSvgY = (y: number) => height - (y - minY);

  return (
    <section className="card">
      <div className="card__header">
        <div>
          <p className="eyebrow">Visualization</p>
          <h2>{title}</h2>
          {subtitle ? <p className="map-subtitle">{subtitle}</p> : null}
        </div>
        <div className="map-yardage">{Math.round(hole.yardage)}y</div>
      </div>

      <svg className="hole-map" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <rect x="0" y="0" width={width} height={height} rx="20" className="hole-map__base" />

        <rect
          x={toSvgX(hole.fairway_center_x - (hole.fairway_width / 2 + hole.rough_width))}
          y={toSvgY(hole.fairway_end_y)}
          width={hole.fairway_width + hole.rough_width * 2}
          height={hole.fairway_end_y - hole.fairway_start_y}
          className="hole-map__rough"
        />
        <rect
          x={toSvgX(hole.fairway_center_x - hole.fairway_width / 2)}
          y={toSvgY(hole.fairway_end_y)}
          width={hole.fairway_width}
          height={hole.fairway_end_y - hole.fairway_start_y}
          className="hole-map__fairway"
        />
        <circle
          cx={toSvgX(hole.green_center.x)}
          cy={toSvgY(hole.green_center.y)}
          r={hole.green_radius}
          className="hole-map__green"
        />
        <circle
          cx={toSvgX(hole.tee.x)}
          cy={toSvgY(hole.tee.y)}
          r="5"
          className="hole-map__tee"
        />

        {hole.hazards.map((hazard, index) => {
          if (hazard.shape === "circle" && hazard.radius) {
            return (
              <circle
                key={`${hazard.kind}-${index}`}
                cx={toSvgX(hazard.center_x)}
                cy={toSvgY(hazard.center_y)}
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
                x={toSvgX(hazard.center_x - hazard.width / 2)}
                y={toSvgY(hazard.center_y + hazard.depth / 2)}
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
                x={toSvgX(hazard.center_x - hazard.width / 2)}
                y={toSvgY(hazard.end_y)}
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
            x1={toSvgX(startPosition.x)}
            y1={toSvgY(startPosition.y)}
            x2={toSvgX(targetPosition.x)}
            y2={toSvgY(targetPosition.y)}
            className="hole-map__line hole-map__line--target"
          />
        ) : null}

        {startPosition && aimPoint ? (
          <line
            x1={toSvgX(startPosition.x)}
            y1={toSvgY(startPosition.y)}
            x2={toSvgX(aimPoint.x)}
            y2={toSvgY(aimPoint.y)}
            className="hole-map__line hole-map__line--aim"
          />
        ) : null}

        {shotSamples.map((sample, index) => (
          <circle
            key={`${sample.x}-${sample.y}-${index}`}
            cx={toSvgX(sample.x)}
            cy={toSvgY(sample.y)}
            r="2.8"
            className={`hole-map__sample hole-map__sample--${sample.surface}`}
          />
        ))}

        {aimPoint ? (
          <circle
            cx={toSvgX(aimPoint.x)}
            cy={toSvgY(aimPoint.y)}
            r="5.5"
            className="hole-map__aim-point"
          />
        ) : null}

        {targetPosition ? (
          <circle
            cx={toSvgX(targetPosition.x)}
            cy={toSvgY(targetPosition.y)}
            r="4.2"
            className="hole-map__target-point"
          />
        ) : null}
      </svg>

      <div className="map-legend">
        <span><i className="legend-swatch legend-swatch--fairway" /> Fairway</span>
        <span><i className="legend-swatch legend-swatch--rough" /> Rough</span>
        <span><i className="legend-swatch legend-swatch--green" /> Green</span>
        <span><i className="legend-swatch legend-swatch--bunker" /> Bunker</span>
        <span><i className="legend-swatch legend-swatch--water" /> Water</span>
        <span><i className="legend-swatch legend-swatch--ob" /> OB</span>
        {aimPoint ? <span><i className="legend-swatch legend-swatch--aim" /> Recommended aim</span> : null}
      </div>
    </section>
  );
}
