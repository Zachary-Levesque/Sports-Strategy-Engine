export type RiskTolerance = "low" | "medium" | "high";

export interface PlayerSummary {
  id: number;
  player_name: string;
  handicap: number;
  handedness: string;
  preferred_shape: string;
  miss_tendency: string;
  risk_tolerance: RiskTolerance;
  club_count: number;
}

export interface HoleSummary {
  id: number;
  hole_id: string;
  name: string;
  par: number;
  yardage: number;
  wind_speed_mph: number;
  wind_direction_deg: number;
}

export interface HealthResponse {
  status: string;
  database: string;
  version: string;
}

export interface AimPoint {
  x: number;
  y: number;
}

export interface StrategySummary {
  club: string;
  aim_label: string;
  aim_point: AimPoint;
  shot_shape: string;
  swing_intensity: number;
  expected_strokes: number;
  risk_adjusted_score: number;
  penalty_probability: number;
  fairway_probability: number;
  rough_probability: number;
  green_probability: number;
  bunker_probability: number;
  water_probability: number;
  ob_probability: number;
  variance: number;
}

export interface RecommendationResponse {
  recommendation_id: number | null;
  player_name: string;
  hole_id: string;
  best_strategy: StrategySummary;
  probabilities: {
    penalty_probability: number;
    fairway_probability: number;
    rough_probability: number;
    green_probability: number;
    bunker_probability: number;
    water_probability: number;
    ob_probability: number;
    recovery_probability: number;
  };
  expected_strokes: number;
  risk_adjusted_score: number;
  variance: number;
  shot_cloud_summary: {
    sample_count: number;
    centroid: AimPoint;
    x_range: number[];
    y_range: number[];
  };
  explanation: string;
  top_alternatives: StrategySummary[];
}

export interface RecommendationRequest {
  player_name: string;
  hole_id: string;
  iterations: number;
  risk_tolerance_override?: RiskTolerance;
}
