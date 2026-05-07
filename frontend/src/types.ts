export type RiskTolerance = "low" | "medium" | "high";

export interface PlayerSummary {
  player_name: string;
  handicap: number;
  handedness: string;
  preferred_shape: string;
  miss_tendency: string;
  risk_tolerance: RiskTolerance;
  club_count: number;
}

export interface HoleSummary {
  hole_id: string;
  name: string;
  par: number;
  yardage: number;
  wind_speed_mph: number;
  wind_direction_deg: number;
}

export interface HealthResponse {
  status: string;
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
  player_name: string;
  hole_id: string;
  recommendation: StrategySummary;
  explanation: string;
  top_alternatives: StrategySummary[];
}

export interface RecommendationRequest {
  player_name: string;
  hole_id: string;
  iterations: number;
  risk_tolerance_override?: RiskTolerance;
}
