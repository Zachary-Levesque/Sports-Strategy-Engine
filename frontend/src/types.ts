export type RiskTolerance = "low" | "medium" | "high";
export type ShotShape = "straight" | "draw" | "fade";
export type Handedness = "right" | "left";
export type MissTendency = "center" | "none" | "left" | "right" | "pull" | "push";

export interface ClubData {
  id?: number;
  club: string;
  carry_yards: number;
  total_yards: number;
  lateral_sigma: number;
  distance_sigma: number;
  confidence: number;
  shape_bias: number;
  lie_adjustment_sensitivity: number;
}

export interface PlayerPayload {
  player_name: string;
  handicap: number;
  handedness: Handedness;
  preferred_shape: ShotShape;
  miss_tendency: MissTendency;
  risk_tolerance: RiskTolerance;
  clubs: ClubData[];
}

export interface PlayerSummary {
  id: number;
  player_name: string;
  handicap: number;
  handedness: Handedness;
  preferred_shape: ShotShape;
  miss_tendency: MissTendency;
  club_count: number;
  risk_tolerance: RiskTolerance;
}

export interface PlayerDetail extends PlayerPayload {
  id: number;
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

export interface WindData {
  speed_mph: number;
  direction_deg: number;
}

export interface HazardData {
  kind: string;
  shape: string;
  center_x: number;
  center_y: number;
  radius?: number | null;
  width?: number | null;
  depth?: number | null;
  start_y?: number | null;
  end_y?: number | null;
  x_min?: number | null;
  x_max?: number | null;
  y_min?: number | null;
  y_max?: number | null;
  penalty_strokes: number;
}

export interface HolePayload {
  hole_id: string;
  name: string;
  par: number;
  yardage: number;
  tee: AimPoint;
  green_center: AimPoint;
  green_radius: number;
  fairway_center_x: number;
  fairway_width: number;
  fairway_start_y: number;
  fairway_end_y: number;
  rough_width: number;
  hazards: HazardData[];
  wind: WindData;
}

export interface HoleDetail extends HolePayload {
  id: number;
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

export interface ScenarioSummary {
  id: number | null;
  name: string;
  player_name: string;
  hole_id: string;
  iterations: number;
  risk_tolerance_override?: RiskTolerance | null;
}

export interface RecommendationHistoryItem {
  recommendation_id: number;
  player_name: string;
  hole_id: string;
  created_at: string;
  expected_strokes: number;
  risk_adjusted_score: number;
  penalty_probability: number;
  explanation: string;
  best_strategy: StrategySummary;
}
