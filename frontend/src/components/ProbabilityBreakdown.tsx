import type { StrategySummary } from "../types";

interface ProbabilityBreakdownProps {
  recommendation: StrategySummary;
}

const items = [
  { label: "Fairway", key: "fairway_probability" },
  { label: "Rough", key: "rough_probability" },
  { label: "Green", key: "green_probability" },
  { label: "Bunker", key: "bunker_probability" },
  { label: "Water", key: "water_probability" },
  { label: "OB", key: "ob_probability" },
] as const;

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function ProbabilityBreakdown({
  recommendation,
}: ProbabilityBreakdownProps) {
  return (
    <section className="card">
      <div className="card__header">
        <div>
          <p className="eyebrow">Outcome Mix</p>
          <h2>Probabilities</h2>
        </div>
      </div>

      <div className="probability-list">
        {items.map((item) => {
          const value = recommendation[item.key];
          return (
            <div key={item.key} className="probability-item">
              <div className="probability-item__meta">
                <span>{item.label}</span>
                <strong>{formatPercent(value)}</strong>
              </div>
              <div className="probability-bar">
                <span
                  className="probability-bar__fill"
                  style={{ width: `${Math.max(value * 100, 2)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
