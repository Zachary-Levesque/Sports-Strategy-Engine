# Sports Strategy Engine

Sports Strategy Engine is a Python MVP for personalized golf strategy optimization. It evaluates club, aim point, shot shape, and swing intensity combinations with Monte Carlo simulation, then recommends the best option using expected strokes and risk-adjusted scoring.

## MVP Features

- Personalized player profiles with club-by-club carry, total distance, dispersion, confidence, shot-shape preference, miss tendency, and risk tolerance
- Simplified hole model with tee, fairway, green, rough, bunker, water, and out-of-bounds zones
- Candidate strategy generation across:
  - clubs
  - aim points
  - shot shapes: `straight`, `draw`, `fade`
  - swing intensities: `70%`, `80%`, `90%`, `100%`
- 2D Gaussian shot simulation with wind, shape bias, miss bias, and intensity-based dispersion changes
- Outcome classification into fairway, rough, green, bunker, water, OB, or recovery
- Risk metrics including expected strokes, penalty probability, surface probabilities, and variance
- Plot output showing the hole, shot cloud, aim point, and recommended line

## Project Structure

```text
python/
data/
results/
tests/
docs/
```

## Install

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run The Prototype

```bash
python python/prototype.py
```

The prototype loads a sample player and hole from `data/`, runs the optimizer, prints the recommendation, and saves a plot into `results/plots/`.

## Run Tests

```bash
pytest
```

## Run The API

```bash
uvicorn api.main:app --reload
```

This starts a FastAPI backend from the project root for a future React or TypeScript frontend.

## Example POST Request

```bash
curl -X POST http://127.0.0.1:8000/recommendation \
  -H "Content-Type: application/json" \
  -d '{
    "player_name": "Zachary",
    "hole_id": "harbor_par4",
    "iterations": 1000,
    "risk_tolerance_override": "medium"
  }'
```

## Example JSON Response

```json
{
  "player_name": "Zachary",
  "hole_id": "harbor_par4",
  "recommendation": {
    "club": "4-Iron",
    "aim_label": "front green",
    "aim_point": {"x": 0.0, "y": 407.2},
    "shot_shape": "draw",
    "swing_intensity": 1.0,
    "expected_strokes": 3.21,
    "risk_adjusted_score": 3.34,
    "penalty_probability": 0.013,
    "fairway_probability": 0.065,
    "rough_probability": 0.029,
    "green_probability": 0.364,
    "bunker_probability": 0.053,
    "water_probability": 0.009,
    "ob_probability": 0.004,
    "variance": 0.599
  },
  "explanation": "4-Iron to front green is best because it produced the lowest risk-adjusted score.",
  "top_alternatives": [
    {
      "club": "4-Iron",
      "aim_label": "front green",
      "aim_point": {"x": 0.0, "y": 407.2},
      "shot_shape": "straight",
      "swing_intensity": 1.0,
      "expected_strokes": 3.28,
      "risk_adjusted_score": 3.44,
      "penalty_probability": 0.028,
      "fairway_probability": 0.072,
      "rough_probability": 0.032,
      "green_probability": 0.338,
      "bunker_probability": 0.054,
      "water_probability": 0.017,
      "ob_probability": 0.011,
      "variance": 0.729
    }
  ]
}
```

## Sample Output

```text
Player: Zachary
Hole: Harbor Line (Par 4, 418 yards)
Wind: 10 mph at 70 degrees

Recommended strategy
  Club: 3-Wood
  Aim point: center fairway at (0.0, 259.2)
  Shot shape: straight
  Swing intensity: 100%
  Expected strokes: 4.14
  Risk-adjusted score: 4.42
  Penalty probability: 3.0%
```

Exact values vary slightly because the engine ranks many simulated strategies, but the output is deterministic for the same code and seeds.

## What The MVP Does

This version solves the first working product slice:

- load a golfer profile
- load or generate a hole
- build realistic candidate shots
- simulate the landing cloud for each option
- estimate strokes remaining from the resulting lie
- rank the strategies for the player’s risk tolerance
- explain the recommendation
- visualize the winning shot pattern

## Roadmap

- Connect a React or TypeScript frontend to the new FastAPI recommendation endpoint
- Port the Monte Carlo core into C++ for higher simulation throughput
- Add a React/TypeScript UI for profile editing, hole selection, and visual strategy comparison
- Extend the continuation model into multi-shot planning and richer lie/elevation handling
