import type { RecommendationResponse } from "../types";

interface RecommendationCardProps {
  result: RecommendationResponse;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function RecommendationCard({ result }: RecommendationCardProps) {
  const recommendation = result.best_strategy;

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
          <span className="stat__label">Shot Mode</span>
          <strong>{result.shot_mode === "tee" ? "Tee shot" : "Custom shot"}</strong>
        </div>
        <div className="stat">
          <span className="stat__label">Lie</span>
          <strong>{result.lie}</strong>
        </div>
        <div className="stat">
          <span className="stat__label">Aim Point</span>
          <strong>{recommendation.aim_label}</strong>
          <span>
            ({recommendation.aim_point.x.toFixed(1)},{" "}
            {recommendation.aim_point.y.toFixed(1)})
          </span>
        </div>
        <div className="stat">
          <span className="stat__label">Target Position</span>
          <strong>
            ({result.target_position.x.toFixed(1)}, {result.target_position.y.toFixed(1)})
          </strong>
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
          <strong>{result.expected_strokes.toFixed(2)}</strong>
        </div>
        <div className="stat">
          <span className="stat__label">Risk-Adjusted Score</span>
          <strong>{result.risk_adjusted_score.toFixed(2)}</strong>
        </div>
        <div className="stat">
          <span className="stat__label">Penalty Probability</span>
          <strong>{formatPercent(result.probabilities.penalty_probability)}</strong>
        </div>
        <div className="stat">
          <span className="stat__label">Variance</span>
          <strong>{result.variance.toFixed(3)}</strong>
        </div>
        <div className="stat">
          <span className="stat__label">Shot Cloud Samples</span>
          <strong>{result.shot_cloud_summary.sample_count}</strong>
        </div>
      </div>

      <div className="explanation">
        <p className="eyebrow">Why this line</p>
        <p>{result.explanation}</p>
      </div>
    </section>
  );
}
