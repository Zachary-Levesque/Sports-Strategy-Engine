import type { RecommendationResponse } from "../types";

interface RecommendationCardProps {
  result: RecommendationResponse;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function RecommendationCard({ result }: RecommendationCardProps) {
  const recommendation = result.recommendation;

  return (
    <section className="card card--highlight">
      <div className="card__header">
        <div>
          <p className="eyebrow">Best Strategy</p>
          <h2>Recommended Shot</h2>
        </div>
        <div className="pill">{recommendation.club}</div>
      </div>

      <div className="result-grid">
        <div className="stat">
          <span className="stat__label">Aim Point</span>
          <strong>{recommendation.aim_label}</strong>
          <span>
            ({recommendation.aim_point.x.toFixed(1)},{" "}
            {recommendation.aim_point.y.toFixed(1)})
          </span>
        </div>
        <div className="stat">
          <span className="stat__label">Shot Shape</span>
          <strong>{recommendation.shot_shape}</strong>
        </div>
        <div className="stat">
          <span className="stat__label">Swing Intensity</span>
          <strong>{Math.round(recommendation.swing_intensity * 100)}%</strong>
        </div>
        <div className="stat">
          <span className="stat__label">Expected Strokes</span>
          <strong>{recommendation.expected_strokes.toFixed(2)}</strong>
        </div>
        <div className="stat">
          <span className="stat__label">Risk-Adjusted Score</span>
          <strong>{recommendation.risk_adjusted_score.toFixed(2)}</strong>
        </div>
        <div className="stat">
          <span className="stat__label">Penalty Probability</span>
          <strong>{formatPercent(recommendation.penalty_probability)}</strong>
        </div>
        <div className="stat">
          <span className="stat__label">Variance</span>
          <strong>{recommendation.variance.toFixed(3)}</strong>
        </div>
      </div>

      <div className="explanation">
        <p className="eyebrow">Why this line</p>
        <p>{result.explanation}</p>
      </div>
    </section>
  );
}
