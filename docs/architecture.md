# Architecture

Sports Strategy Engine is a local full-stack golf strategy optimizer with four main layers:

1. `backend/app/simulation`
   The domain simulation engine. It owns player models, hole models, shot option generation, Monte Carlo sampling, risk scoring, and visualization-friendly summaries. This layer is intentionally isolated so it can later be swapped behind the same service boundary with a C++ core.
2. `backend/app`
   The FastAPI application. It owns HTTP routing, request validation, response schemas, persistence, startup seeding, logging, and exception handling.
3. `frontend/src`
   The React + TypeScript client. It owns the user workflows for strategy recommendations, player editing, hole editing, and recommendation history.
4. `python/`
   Compatibility CLI wrappers for the original prototype entrypoint. These reuse the shared backend simulation layer so there is only one simulation implementation to maintain.

## Backend Structure

`backend/app/api/routes`
- HTTP endpoints for health, players, holes, scenarios, and recommendations.

`backend/app/core`
- App settings, custom exceptions, and structured logging helpers.

`backend/app/database`
- SQLAlchemy engine/session setup and database initialization.

`backend/app/models`
- ORM models for players, clubs, holes, scenarios, and recommendation history.

`backend/app/schemas`
- Pydantic request/response models used by the API.

`backend/app/services`
- Application services for CRUD operations, seeding, simulation orchestration, and persistence.

`backend/app/simulation`
- Shared simulation logic:
  - `player_model.py`
  - `hole_generator.py`
  - `decision_engine.py`
  - `monte_carlo.py`
  - `risk_metrics.py`
  - `visualize.py`

## Frontend Structure

`frontend/src/App.tsx`
- Top-level single-page app with the main navigation tabs:
  - Strategy
  - Players
  - Holes
  - History

`frontend/src/api/client.ts`
- Fetch wrapper for the backend API at `http://localhost:8000`.

`frontend/src/components`
- Reusable UI pieces for selectors, recommendation rendering, alternatives, and probability analytics.

`frontend/src/types.ts`
- Shared TypeScript types aligned to backend response schemas.

## Persistence Model

SQLite is stored at `data/sports_strategy_engine.db`.

Persisted entities:
- players
- clubs
- holes
- scenarios
- recommendation history

Startup behavior:
- the backend creates tables automatically
- if the database is empty, seed data is loaded from `data/player_profiles.json`, `data/generated_holes.json`, and `data/scenarios.json`

## Request Flow

1. The frontend loads players, holes, scenarios, and history through FastAPI.
2. The user selects a player, hole, iterations count, and optional risk override.
3. `POST /recommendation` validates the request and resolves the player/hole from SQLite.
4. The recommendation service converts persisted records into simulation-domain models.
5. The decision engine generates candidate strategies across club, target, shot shape, and swing intensity.
6. Monte Carlo simulation evaluates each strategy and computes expected strokes, penalties, dispersion, and outcome probabilities.
7. Risk scoring ranks strategies.
8. The best result and top alternatives are returned to the frontend and persisted to recommendation history.

## Design Principles

- One simulation implementation only. The CLI and API both use the same simulation modules.
- Business-key CRUD for the UI. Players are addressed by `player_name` and holes by `hole_id`.
- Thin routes, thicker services. HTTP concerns stay in route modules while orchestration stays in services.
- Stable schema boundaries. Pydantic and TypeScript types are kept aligned so the frontend consumes real backend data without ad hoc transformation logic.
- Future C++ portability. Simulation-specific code is separated from HTTP, ORM, and frontend concerns.
