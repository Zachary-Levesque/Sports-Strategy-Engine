# API Reference

Base URL for local development:

`http://localhost:8000`

All responses are JSON.

## Health

### `GET /health`

Returns backend health information.

Example response:

```json
{
  "status": "ok",
  "database": "ok",
  "version": "1.0.0"
}
```

## Players

### `GET /players`

Returns all players with summary information.

### `GET /players/{player_name}`

Returns a full player profile including clubs.

### `POST /players`

Creates a player.

Request body:

```json
{
  "name": "Demo Player",
  "handedness": "right",
  "confidence": 0.72,
  "preferred_shot_shape": "draw",
  "miss_tendency": "right",
  "risk_tolerance": "medium",
  "clubs": [
    {
      "name": "Driver",
      "carry_yards": 255,
      "total_yards": 272,
      "lateral_sigma": 19,
      "distance_sigma": 11
    }
  ]
}
```

### `PUT /players/{player_name}`

Updates a player and replaces the club set with the submitted clubs.

### `DELETE /players/{player_name}`

Deletes a player. Any scenarios referencing that player are also removed.

## Holes

### `GET /holes`

Returns all holes with summary metadata.

### `GET /holes/{hole_id}`

Returns a full editable hole definition.

### `POST /holes`

Creates a hole.

### `PUT /holes/{hole_id}`

Updates a hole using the submitted `hole_id` payload.

### `DELETE /holes/{hole_id}`

Deletes a hole. Any scenarios referencing that hole are also removed.

## Scenarios

### `GET /scenarios`

Returns saved scenario presets that connect a player, hole, iteration count, and optional risk override.

## Recommendations

### `POST /recommendation`

Runs the full recommendation engine and persists the result to recommendation history.

Request body:

```json
{
  "player_name": "Zachary",
  "hole_id": "harbor_par4",
  "iterations": 2000,
  "risk_tolerance_override": "medium"
}
```

Response shape:

```json
{
  "recommendation_id": 21,
  "player_name": "Zachary",
  "hole_id": "harbor_par4",
  "best_strategy": {
    "club": "4-Iron",
    "aim_label": "left fairway",
    "aim_point": {"x": -7.5, "y": 212.0},
    "shot_shape": "draw",
    "swing_intensity": 1.0,
    "expected_strokes": 5.21,
    "risk_adjusted_score": 5.24,
    "penalty_probability": 0.011,
    "fairway_probability": 0.634,
    "rough_probability": 0.311,
    "green_probability": 0.0,
    "bunker_probability": 0.002,
    "water_probability": 0.008,
    "ob_probability": 0.003,
    "variance": 0.072
  },
  "top_alternatives": [],
  "probabilities": {
    "penalty_probability": 0.011,
    "fairway_probability": 0.634,
    "rough_probability": 0.311,
    "green_probability": 0.0,
    "bunker_probability": 0.002,
    "water_probability": 0.008,
    "ob_probability": 0.003,
    "recovery_probability": 0.042
  },
  "expected_strokes": 5.21,
  "risk_adjusted_score": 5.24,
  "variance": 0.072,
  "shot_cloud_summary": {
    "sample_count": 350,
    "centroid": {"x": -2.6, "y": 213.4},
    "x_range": [-40.3, 29.1],
    "y_range": [184.7, 242.5]
  },
  "explanation": "4-Iron to left fairway is best because it produced the lowest risk-adjusted score."
}
```

### `POST /simulate`

Runs the same simulation pipeline but returns the broader ranked-strategy summary payload used for diagnostics.

### `GET /recommendations/history`

Returns recent persisted recommendation runs. The frontend uses this for the History view.

## Error Responses

Validation failures return HTTP `422`:

```json
{
  "detail": "Request validation failed."
}
```

Application-level errors such as missing players or holes return `404` or `400`:

```json
{
  "detail": "Player 'Unknown' was not found."
}
```

Unhandled server faults return `500`:

```json
{
  "detail": "Internal server error."
}
```
