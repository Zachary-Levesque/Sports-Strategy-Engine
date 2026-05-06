# instructions.md

## Mission

Build this repository from scratch into a working **Sports Strategy Engine** based on the existing `README.md`.

The product is a personalized golf decision engine that recommends the optimal:

- club
- aim point
- shot shape
- swing intensity

for a given golfer, hole, and conditions using:

- player-specific yardages
- probabilistic shot dispersion
- golf hole geometry
- Monte Carlo simulation
- expected strokes optimization
- risk analysis
- an interactive UI

This repository currently has almost no implementation. You must create the full project structure, implement the core system, make it runnable, test it, and leave the repo in a state where a developer can clone it and run it locally.

Do not produce a speculative prototype with placeholder files only. Build a real, functioning MVP with clean architecture, tests, sample data, documentation, and a usable UI.

## Non-Negotiable Working Style

You are acting as the builder for this repository.

Requirements:

1. Read `README.md` first and treat it as the product brief.
2. Build the project directly in this repository.
3. Make reasonable engineering decisions without stopping for approval unless blocked by missing credentials or external access.
4. Prefer shipping a coherent working MVP over partially scaffolding a grand architecture.
5. Do not leave core logic as TODOs.
6. Do not fake results, benchmarks, or tests.
7. Every major feature must be runnable or demonstrably testable.
8. If you must reduce scope, reduce only the most advanced extensions first, not the core engine.
9. Keep the codebase clean, modular, and documented.
10. At the end, run tests and verify the app boots.

## What “Done” Means

The repository is only complete when all of the following are true:

- there is a working Python simulation engine
- there is a working decision optimizer
- there is a working procedural hole generator
- there is a working API layer or local interface between backend logic and UI
- there is a working React + TypeScript UI
- the UI can load a sample player and sample/generated hole
- the UI can request a recommendation and display:
  - recommended club
  - aim point
  - shot shape
  - swing intensity
  - expected strokes
  - penalty probability
  - comparison of candidate strategies
- there are tests for the core simulation logic
- there is seed/sample data
- there are docs explaining architecture and how to run everything
- the repo can be installed and run locally with clear commands
- no critical broken imports or dead paths remain

## Scope Priority

Implement in this order of priority:

1. Working Python MVP
2. Working UI connected to Python backend
3. Good documentation and tests
4. C++ simulation core
5. Benchmarking
6. Advanced AI / reinforcement learning extension

The C++ layer is important, but if time or complexity forces a tradeoff, the Python engine + full product flow must work first.

## Required Tech Stack

Use these unless there is a strong technical reason not to:

### Backend / Simulation
- Python 3.11+
- FastAPI for API
- Pydantic for data models
- NumPy for simulation
- Pandas only if actually useful
- pytest for tests

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- SVG or Canvas for hole visualization

### C++ Layer
- Modern C++17 or newer
- CMake
- clean class structure
- optional CLI executable for simulation/benchmarking

## Required Repository Structure

Create and populate this structure, adapting only where necessary for real implementation quality:

```text
Sports-Strategy-Engine/
├── README.md
├── instructions.md
├── docs/
│   ├── architecture.md
│   ├── math_model.md
│   ├── optimization.md
│   ├── ui_design.md
│   ├── roadmap.md
│   └── benchmarking.md
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   ├── core/
│   │   ├── models/
│   │   ├── services/
│   │   └── utils/
│   ├── tests/
│   ├── requirements.txt
│   └── pyproject.toml
├── cpp/
│   ├── include/
│   ├── src/
│   ├── benchmarks/
│   └── CMakeLists.txt
├── ui/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
├── data/
│   ├── player_profiles.json
│   ├── sample_courses.json
│   ├── generated_holes.json
│   └── scenarios.json
├── results/
│   └── .gitkeep
└── scripts/
    ├── run_backend.sh
    ├── run_ui.sh
    └── dev.sh
```

If you improve the structure, keep it simple and justified.

## Core Product Requirements

## 1. Player Profile System

Implement a player profile model with:

- player name
- handicap
- handedness
- preferred shot shape
- miss tendency
- risk tolerance
- per-club data

Per-club data must support at least:

- club name
- carry distance
- total distance
- lateral dispersion sigma
- distance dispersion sigma
- confidence
- optional shape bias
- optional lie adjustment sensitivity

Provide at least 2 sample player profiles in `data/player_profiles.json`.

## 2. Hole / Environment Model

Implement a hole representation that supports:

- par
- yardage
- tee position
- green center
- fairway geometry
- rough zones
- hazards
- green radius or polygon
- wind speed
- wind direction
- optional elevation

Hazards must support at least:

- water
- bunker
- trees/recovery
- out of bounds

Use simple geometry first:
- circles
- ellipses
- corridors
- rectangles
- centerline fairway with width profile

Do not block progress on complex GIS-grade geometry. Build a robust simplified course model that works.

Provide:
- a few handcrafted sample holes
- a procedural hole generator that can create par 3, par 4, and par 5 holes

## 3. Shot Option Generator

Generate candidate strategies by combining:

- club
- aim point
- shot shape
- swing intensity

Minimum shot shapes:
- straight
- draw
- fade

Minimum swing intensities:
- 0.7
- 0.8
- 0.9
- 1.0

Aim points should be generated from useful golf targets, not random noise. Include things like:
- center fairway
- left fairway
- right fairway
- layup short of hazard
- center green
- front/middle/back green when relevant
- safe bailout zone

The option generator must prune obviously bad combinations where appropriate so the engine stays usable.

## 4. Player Probabilistic Shot Model

Implement a probabilistic shot model that converts a shot decision into a landing distribution.

Minimum behavior:
- expected carry distance based on club and swing intensity
- expected total distance
- lateral and distance dispersion
- shot shape bias
- miss tendency bias
- confidence adjustment
- wind adjustment
- lie adjustment

A 2D Gaussian-based model is acceptable for the MVP.

At minimum model:
- downrange distance
- lateral offset
- covariance or independent sigmas
- bias adjustments from shape/wind/miss tendency

Document the formulas actually used.

## 5. Monte Carlo Simulation Engine

Implement a real Monte Carlo engine.

For each candidate strategy:
1. sample many shot outcomes
2. determine landing location
3. classify result:
   - fairway
   - rough
   - bunker
   - green
   - water
   - out of bounds
   - recovery
4. estimate continuation difficulty / strokes to hole
5. compute total expected strokes
6. compute risk metrics

The engine does not need to play every future shot at full recursive depth initially if that is too slow. A strong MVP can use a **strokes-remaining approximation model** after the landing result, as long as it is consistent and documented.

For example, estimate strokes remaining based on:
- distance to pin
- lie type
- hazard penalty state
- whether the ball is on green
- whether the ball is in recovery trouble

This is acceptable if implemented cleanly and explained.

## 6. Decision Engine

Implement a ranking engine that evaluates each strategy using:

- expected strokes
- penalty probability
- variance / standard deviation
- birdie or par opportunities if feasible
- risk-adjusted score

Support at least three risk tolerances:
- low
- medium
- high

These should affect recommendation behavior through a real scoring function.

The engine output must include:
- best strategy
- top alternatives
- explanation fields
- risk metrics

## 7. Explanation Layer

The system must not only output the best strategy but also explain why.

Generate structured explanation text such as:
- this option minimized expected strokes
- this option reduced penalty exposure
- this option traded distance for tighter dispersion
- driver was rejected because water/OB risk was too high

This explanation does not need an LLM. Deterministic explanation logic is preferred.

## 8. Backend API

Build a FastAPI backend that exposes at least:

### `GET /health`
Returns service health.

### `GET /players`
Returns available sample players.

### `GET /holes`
Returns available sample holes.

### `POST /holes/generate`
Generates a procedural hole from parameters.

### `POST /simulate/recommendation`
Accepts:
- player profile or player ID
- hole definition or hole ID
- conditions
- optional simulation count
- optional risk preference override

Returns:
- best recommendation
- ranked strategies
- summary metrics
- shot cloud sample points or compact visualization data

Validate requests with Pydantic.

## 9. Frontend UI

Build a polished, usable UI. It should not look like a generic admin panel.

The UI must include:

### Left panel
- player profile selector
- editable club data table or profile summary
- risk tolerance selector
- conditions controls

### Center panel
- hole map visualization
- tee, fairway, green, hazards
- recommended aim line
- optional shot dispersion cloud overlay
- candidate target markers

### Right panel
- recommended strategy card
- expected strokes
- penalty probability
- strategy comparison table
- explanation text

The UI must allow the user to:
1. choose a sample player
2. choose a sample hole or generate one
3. run the recommendation engine
4. see the recommended strategy and alternatives visually

The frontend must be connected to the real backend API, not mocked only.

## 10. Visualization

Implement a useful hole map visualization.

Minimum visual requirements:
- distinct tee, fairway, rough, green, and hazard rendering
- shot target marker
- recommended shot line
- visible dispersion cloud or confidence ellipse
- readable scaling and labels

Use simple but clear geometric rendering. Accuracy to the simulation model matters more than flashy effects.

## 11. Tests

Add real tests for the backend.

At minimum test:
- player model calculations
- procedural hole generation validity
- simulation engine sanity
- hazard classification logic
- decision engine ranking consistency
- API smoke tests

Tests should verify behavior, not just existence.

Examples:
- a more conservative profile should more strongly penalize risky strategies
- a hole generator should return valid geometry and metadata
- a water hazard near landing area should increase penalty probability
- a shorter club should often reduce hazard exposure on a risky hole

## 12. C++ Simulation Core

After the Python MVP works, build a C++ simulation core in `cpp/`.

Minimum goal:
- represent the core domain models
- simulate candidate strategies
- provide benchmarkable performance
- produce JSON or CSV output

The C++ code does not need to fully replace the Python API unless time permits, but it must be a real implementation, not empty scaffolding.

If practical, mirror the Python simulation behavior closely enough to compare outputs at a coarse level.

## 13. Benchmarking

Add benchmark tooling or scripts that compare:
- Python simulation runtime
- C++ simulation runtime
- optionally multithreaded C++ runtime

Do not invent performance numbers.
Document how to run benchmarks and leave placeholder result files only if they are clearly labeled as generated by the user later.

## 14. Documentation

Write concise but solid docs.

Required:
- `docs/architecture.md`
- `docs/math_model.md`
- `docs/optimization.md`
- `docs/ui_design.md`
- `docs/roadmap.md`

These docs should explain what was actually built, not idealized fiction.

Also update the root `README.md` so it includes:
- project overview
- features implemented
- setup instructions
- run commands
- test commands
- architecture summary
- screenshots section placeholder if needed

## Modeling Guidance

Use simplified but coherent golf math.

### Distance model
Use stock carry distance scaled by swing intensity, with optional nonlinear adjustment if helpful.

### Dispersion model
Dispersion should vary by:
- club
- swing intensity
- lie
- confidence
- shape

### Shape model
Minimum behavior:
- draw shifts/curves left for right-handed golfers
- fade shifts/curves right for right-handed golfers
- reverse if handedness is left-handed if you support that fully

### Wind model
At least:
- headwind reduces carry
- tailwind increases carry
- crosswind shifts lateral outcome

### Lie model
Support at least:
- tee/fairway
- rough
- bunker
- recovery/trouble
- green

### Strokes remaining approximation
You may use a heuristic expected-strokes-remaining model based on:
- distance to pin
- lie type
- penalties
- being on green
- recovery status

If you do this, make it explicit, consistent, and testable.

## Engineering Standards

- Write modular code with small focused components
- Use type hints in Python
- Use clear dataclasses or Pydantic models where appropriate
- Avoid giant files
- Avoid premature abstraction
- Keep naming consistent with the golf domain
- Add comments only where needed
- Make the API contract clean
- Keep the frontend state model understandable
- Prefer deterministic sample data and seeded randomness where useful
- Make procedural generation reproducible with seeds

## Build and Run Requirements

At the end, the repo must support commands equivalent to:

### Backend
```bash
cd backend
pip install -r requirements.txt
pytest
uvicorn app.main:app --reload
```

### Frontend
```bash
cd ui
npm install
npm run dev
```

### C++
```bash
cd cpp
mkdir -p build
cd build
cmake ..
cmake --build .
```

If you use slightly different commands, document them clearly and make sure they work.

## Implementation Order

Use this build sequence:

1. Create backend project structure and domain models
2. Implement sample data loading
3. Implement hole geometry and hazard classification
4. Implement player shot distribution model
5. Implement Monte Carlo simulator
6. Implement decision optimizer and explanation layer
7. Expose backend API
8. Add tests and make them pass
9. Build frontend and connect it to backend
10. Add procedural hole generation UI flow
11. Add C++ core
12. Add benchmark docs/scripts
13. Update docs and README
14. Run verification commands and fix breakages

## Definition of Good Decisions

When architecture choices are ambiguous, prefer:

- simple over clever
- explicit over magical
- working simulation over theoretical perfection
- clean interfaces over over-engineered layers
- useful UI over decorative UI
- reproducible data over random demo behavior
- documented assumptions over hidden heuristics

## Failure Handling

If you hit implementation difficulty:
- do not stop at scaffolding
- reduce complexity while preserving working behavior
- keep the core end-to-end product functional

Acceptable simplifications:
- simplified geometry instead of full polygon physics
- strokes-remaining heuristic instead of full recursive hole play
- deterministic explanation rules instead of NLP generation
- Python-first engine before deeper C++ parity

Unacceptable simplifications:
- mock recommendations with no real simulation
- UI disconnected from backend
- empty docs pretending features exist
- tests that do not test core logic
- placeholder classes with no implementation

## Final Verification Checklist

Before finishing, verify:

- backend installs
- backend tests pass
- backend API boots
- sample recommendation endpoint returns sensible output
- frontend installs
- frontend boots
- frontend can call backend
- sample player + hole produce a recommendation
- procedural hole generation works
- C++ project config builds or is very close with documented status
- README and docs match actual implementation

## Required Final Output From You

When you finish building:
1. summarize what you implemented
2. list exact commands to run backend, frontend, tests, and C++ build
3. note any remaining limitations honestly
4. do not claim features that are not actually implemented

Now build the repository.
