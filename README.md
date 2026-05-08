# Sports Strategy Engine

Sports Strategy Engine is a local full-stack golf strategy optimizer. It combines a Python Monte Carlo simulation engine, a FastAPI backend with SQLite persistence, and a React/TypeScript frontend that consumes the live API.

## Overview

The application now supports:

- seeded player, hole, and scenario data
- player CRUD with club distance and dispersion editing
- hole CRUD with hazard and wind editing
- tee-shot and custom-shot recommendation generation through Monte Carlo simulation
- live SVG hole previews in the hole editor and strategy view
- shot landing cloud visualization on recommendation results
- persisted recommendation history
- a React dashboard for running and reviewing strategy workflows

## Architecture

- `backend/app/simulation`
  The shared golf simulation engine and decision logic.
- `backend/app`
  FastAPI app, schemas, services, SQLite models, startup seeding, and logging.
- `frontend/src`
  React + TypeScript UI for strategy, player editing, hole editing, and history.
- `python/`
  Compatibility CLI entrypoint for the original prototype.

See [docs/architecture.md](/Users/zacharylevesque/Documents/GitHub/Sports-Strategy-Engine/docs/architecture.md), [docs/api.md](/Users/zacharylevesque/Documents/GitHub/Sports-Strategy-Engine/docs/api.md), and [docs/user_flows.md](/Users/zacharylevesque/Documents/GitHub/Sports-Strategy-Engine/docs/user_flows.md).

## Install

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
cd frontend
npm install
cd ..
```

## Backend Setup

Run the backend from the project root:

```bash
./scripts/run_backend.sh
```

Equivalent command:

```bash
uvicorn backend.app.main:app --reload
```

Backend URL: `http://localhost:8000`

## Frontend Setup

Run the frontend from the project root:

```bash
./scripts/run_frontend.sh
```

Equivalent commands:

```bash
cd frontend
npm run dev
```

Frontend URL: `http://localhost:5173`

## Run Full Stack Locally

1. Start the backend: `./scripts/run_backend.sh`
2. Start the frontend: `./scripts/run_frontend.sh`
3. Open `http://localhost:5173`
4. Use the `Strategy`, `Players`, `Holes`, and `History` tabs

## UI Glossary

- `Distance dispersion`
  How much your shot distance usually varies. Higher number means less consistent distance control.
- `Left/right dispersion`
  How much your shot misses left or right. Higher number means a wider shot pattern.

## Shot Modes

- `Tee shot`
  Starts every simulation from the hole tee and is the default mode.
- `Approach / custom shot`
  Lets you set a live ball position, lie, and target position so the engine can analyze a non-tee shot from the current location.

## Database Setup

- SQLite file: `data/sports_strategy_engine.db`
- Startup behavior: the backend creates tables automatically and seeds players, holes, and scenarios if the database is empty

Reset the local database:

```bash
./scripts/reset_db.sh
```

Or:

```bash
make reset-db
```

## API Endpoint Summary

- `GET /health`
- `GET /players`
- `GET /players/{player_name}`
- `POST /players`
- `PUT /players/{player_name}`
- `DELETE /players/{player_name}`
- `GET /holes`
- `GET /holes/{hole_id}`
- `POST /holes`
- `PUT /holes/{hole_id}`
- `DELETE /holes/{hole_id}`
- `GET /scenarios`
- `POST /recommendation`
- `POST /simulate`
- `GET /recommendations/history`

## Example Recommendation Request

```bash
curl -X POST http://127.0.0.1:8000/recommendation \
  -H "Content-Type: application/json" \
  -d '{
    "player_name": "Zachary",
    "hole_id": "harbor_par4",
    "iterations": 2000,
    "shot_mode": "custom",
    "ball_position": { "x": 4, "y": 155 },
    "lie": "fairway",
    "target_position": { "x": 0, "y": 355 },
    "risk_tolerance_override": "medium"
  }'
```

## Example Recommendation Response

```json
{
  "recommendation_id": 21,
  "player_name": "Zachary",
  "hole_id": "harbor_par4",
  "shot_mode": "custom",
  "start_position": {"x": 4.0, "y": 155.0},
  "target_position": {"x": 0.0, "y": 355.0},
  "lie": "fairway",
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
  "shot_samples": [
    {"x": -4.0, "y": 212.8, "surface": "fairway", "total_strokes": 5.1}
  ],
  "explanation": "4-Iron to left fairway is best because it produced the lowest risk-adjusted score."
}
```

## Manual UI Check

1. Start the backend with `./scripts/run_backend.sh`.
2. Start the frontend with `./scripts/run_frontend.sh`.
3. Open `http://localhost:5173`.
4. In `Players`, edit a club row and verify you can type, delete, paste, and tab through fields normally before saving.
5. In `Holes`, change fairway or hazard values and confirm the live hole preview updates immediately.
6. In `Strategy`, run a tee-shot recommendation and confirm the hole map renders the recommended aim line and landing cloud.
7. Switch to `Approach / custom shot`, set a ball position and target position, rerun, and confirm the map updates from the new start point.
8. Open `History`, refresh the page, and verify the saved recommendation remains present.

## Testing

Backend tests:

```bash
pytest
```

Frontend build validation:

```bash
cd frontend
npm run build
```

Combined helper:

```bash
./scripts/run_tests.sh
```

The CLI prototype still works:

```bash
python python/prototype.py
```

## Troubleshooting

- If the frontend shows `Backend unreachable`, confirm the backend is running at `http://localhost:8000`.
- If port `8000` is already in use, stop the existing process and restart the backend.
- If the UI data looks stale, refresh history or reset the database with `./scripts/reset_db.sh`.
- If you change backend schemas or frontend types, rerun `pytest` and `npm run build`.

## Final Step After This

The remaining final step is deployment packaging and hosting:

- production environment configuration
- build/release workflow
- production process management
- hosting for backend and frontend
