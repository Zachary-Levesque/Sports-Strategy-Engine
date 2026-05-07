import type { StrategySummary } from "../types";

interface AlternativesTableProps {
  alternatives: StrategySummary[];
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function AlternativesTable({
  alternatives,
}: AlternativesTableProps) {
  return (
    <section className="card">
      <div className="card__header">
        <div>
          <p className="eyebrow">Comparison</p>
          <h2>Top Alternatives</h2>
        </div>
      </div>

      <div className="table-wrap">
        <table className="alternatives-table">
          <thead>
            <tr>
              <th>Club</th>
              <th>Aim</th>
              <th>Shape</th>
              <th>Swing</th>
              <th>Expected</th>
              <th>Risk Score</th>
              <th>Penalty</th>
            </tr>
          </thead>
          <tbody>
            {alternatives.map((option, index) => (
              <tr key={`${option.club}-${option.aim_label}-${option.shot_shape}-${index}`}>
                <td>{option.club}</td>
                <td>{option.aim_label}</td>
                <td>{option.shot_shape}</td>
                <td>{Math.round(option.swing_intensity * 100)}%</td>
                <td>{option.expected_strokes.toFixed(2)}</td>
                <td>{option.risk_adjusted_score.toFixed(2)}</td>
                <td>{formatPercent(option.penalty_probability)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
