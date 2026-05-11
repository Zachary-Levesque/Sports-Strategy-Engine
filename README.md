# Sports Strategy Engine

Sports Strategy Engine is a full-stack golf decision-analysis platform for modeling shot strategy under uncertainty. It combines a Monte Carlo shot simulation engine, a FastAPI backend, SQLite persistence, and a React/TypeScript frontend with a visual SVG hole editor so users can define players, design holes, and evaluate strategic shot choices through probabilistic analysis.

It is designed for exploring how player tendencies, hole geometry, dispersion, wind, and risk tolerance influence golf decision-making in a practical interactive workflow.

## Why This Project Is Useful

Most golf tools focus on static distances or simple score tracking. This project is different:

- it models shot outcomes using probabilistic simulation rather than assuming perfect execution
- it compares strategic options using expected strokes, variance, and penalty exposure
- it allows users to create and edit holes visually rather than relying on fixed templates
- it persists recommendation and simulation history so results can be reviewed after each run

The result is a practical sandbox for course strategy analysis, simulation-based coaching, and product experimentation around golf intelligence workflows.

## Main Features

- Player profile management with editable club distances, dispersion, confidence, and risk tolerance
- Hole creation and editing with a visual SVG-based course editor
- Terrain and hazard editing for bunkers, water, rough, fairway, tee, pin, and OB corridors
- Tee-shot and custom-shot recommendation workflows
- Monte Carlo simulation engine with risk-adjusted ranking
- Recommendation history stored in SQLite
- Interactive shot-map visualization with aim lines and landing clouds
- Local-first developer workflow with automated tests and frontend build validation

## Technologies Used

- Frontend: React 18, TypeScript, Vite
- Backend: FastAPI, Pydantic, SQLAlchemy
- Database: SQLite
- Simulation: Python, NumPy
- Testing: Pytest
- Tooling: Makefile, shell scripts, npm

## Architecture

- `frontend/src`
  React UI, editor interactions, hole map rendering, and API client logic
- `backend/app/api`
  FastAPI routes for players, holes, recommendations, scenarios, and health
- `backend/app/services`
  Application service layer for persistence, mapping, and orchestration
- `backend/app/simulation`
  Monte Carlo simulation engine, player model, risk scoring, and decision ranking
- `data`
  Seed data for players, holes, and scenarios
- `tests` and `backend/tests`
  Frontend-adjacent and backend simulation/API validation

## How The Editor Works

The hole editor uses an SVG course surface backed by a normalized hole model.

- Clicking an editable object selects it
- A selected object receives a visible red outline
- A center handle appears for repositioning
- Resize handles appear on the selected outline so scale changes are explicit
- Undo history is captured for destructive or structural edits
- Hazard geometry is normalized so kind and shape transitions stay valid

The editor is built to keep object movement stable during drag operations by freezing the projection used for coordinate conversion during active edits.

## Engineering Challenges

- Stable SVG editing with normalized geometry
  The editor has to support selection, dragging, resizing, and geometry updates without letting shapes drift, corrupt, or become invalid.
- Probabilistic shot-dispersion modeling
  The simulation system converts player skill, club characteristics, lie, wind, and shot shape into a 2D probabilistic outcome model.
- Expected value vs variance tradeoffs
  The engine does not optimize only for lowest expected strokes; it also weighs variance and penalty exposure based on player risk tolerance.
- Syncing frontend editor state with backend persistence
  The application has to keep temporary editor interactions, saved hole definitions, and API-backed data consistent across edits and reloads.
- Deterministic simulations for testing and reproducibility
  Seeded simulation runs make debugging and regression testing practical in a stochastic system.

## Installation

### Prerequisites

- Python 3.12+
- Node.js 18+
- npm

### Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
cd frontend
npm install
cd ..
```

## Run The Project Locally

Start the backend from the repository root:

```bash
source .venv/bin/activate
./scripts/run_backend.sh
```

Start the frontend in a second terminal:

```bash
./scripts/run_frontend.sh
```

Open:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`

## Usage

### Strategy Workflow

1. Open the `Strategy` tab.
2. Select a player and hole.
3. Choose `Tee shot` or `Approach / custom shot`.
4. Adjust wind, risk tolerance, and iterations.
5. Run the recommendation engine.
6. Review:
   - best strategy
   - top alternatives
   - probability breakdown
   - explanation
   - shot cloud visualization

### Player Workflow

1. Open `Players`.
2. Create or edit a player profile.
3. Update club carry, total distance, dispersion, and confidence.
4. Save the profile and use it immediately in the strategy workflow.

### Hole Workflow

1. Open `Holes`.
2. Generate a base layout from par, yardage, and shape.
3. Select a terrain element or hazard to edit it.
4. Use the center handle to move the object.
5. Use resize handles to change width, radius, depth, or corridor span.
6. Save the hole and reuse it in strategy simulations.

## Controls And Editing System

### Selection

- Click an object to select it
- Selected objects show a red outline

### Movement

- Drag the center handle of the selected object to move it

### Resizing

- Drag visible resize handles on the selected outline
- Fairway and rough expose width handles
- Hazards expose geometry-appropriate handles based on shape

### Undo

- Use `Cancel last change` in the editor toolbar to revert the last structural edit

## Testing

Run the full automated checks:

```bash
./scripts/run_tests.sh
```

Or run them individually:

```bash
./.venv/bin/pytest
cd frontend && npm run build
```

## Project Structure

```text
Sports-Strategy-Engine/
├── backend/
├── frontend/
├── data/
├── docs/
├── python/
├── scripts/
├── tests/
├── Makefile
└── README.md
```

## Roadmap

- Add browser-based integration tests for the hole editor
- Add export/import for custom holes and player profiles
- Add multi-shot hole strategy planning instead of single-shot ranking only
- Add richer hazard templates and terrain sculpting tools
- Add deployment configuration for hosted demo environments
- Add analytics and comparative strategy reporting

## Documentation

- [Architecture Notes](docs/architecture.md)
- [API Reference](docs/api.md)
- [Math Model](docs/math_model.md)
- [User Flows](docs/user_flows.md)

## License

Add a project license before public release.
