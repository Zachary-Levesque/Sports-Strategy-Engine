# Sports Strategy Engine

Sports Strategy Engine is a full-stack golf strategy optimizer. It combines a Python Monte Carlo simulation engine, a FastAPI backend with SQLite persistence, and a React/TypeScript frontend that consumes the live recommendation API.

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
backend/
python/
api/
frontend/
data/
results/
tests/
docs/
scripts/
```

## Install

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Optional local configuration:

```bash
cp .env.example .env
```

## Run The API

```bash
uvicorn backend.app.main:app --reload
```

This starts the FastAPI backend from the project root at `http://localhost:8000`.

## Run The Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite frontend runs at `http://localhost:5173` and calls the backend at `http://localhost:8000`.

## Run The Prototype

```bash
python python/prototype.py
```

The prototype still works as a local CLI path for the simulation engine and saves plots into `results/plots/`.

## Run Tests

```bash
pytest
```

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
  "recommendation_id": 12,
  "player_name": "Zachary",
  "hole_id": "harbor_par4",
  "best_strategy": {
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
  "probabilities": {
    "penalty_probability": 0.013,
    "fairway_probability": 0.065,
    "rough_probability": 0.029,
    "green_probability": 0.364,
    "bunker_probability": 0.053,
    "water_probability": 0.009,
    "ob_probability": 0.004,
    "recovery_probability": 0.48
  },
  "expected_strokes": 3.21,
  "risk_adjusted_score": 3.34,
  "variance": 0.599,
  "shot_cloud_summary": {
    "sample_count": 350,
    "centroid": {"x": -4.3, "y": 401.5},
    "x_range": [-28.5, 19.2],
    "y_range": [364.1, 429.4]
  },
  "explanation": "4-Iron to front green is best because it produced the lowest risk-adjusted score. Penalty exposure stayed low.",
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

## Developer Helpers

```bash
make backend
make frontend
make test
make build-frontend
make reset-db
```

Shell helpers are also available:

```bash
./scripts/run_backend.sh
./scripts/run_frontend.sh
./scripts/reset_db.sh
```

## Database Reset

```bash
make reset-db
```

## What The App Does

This version now provides:

- load seeded player and hole data from SQLite
- build realistic candidate shots
- simulate the landing cloud for each option
- estimate strokes remaining from the resulting lie
- rank the strategies for the player’s risk tolerance
- explain the recommendation
- persist recommendation results and simulation metadata
- expose the engine through a validated FastAPI service
- serve a connected React frontend at `http://localhost:5173`

## Roadmap

- Port the Monte Carlo core into C++ for higher simulation throughput
- Extend the frontend with hole visualization and richer strategy comparison views
- Extend the continuation model into multi-shot planning and richer lie/elevation handling
