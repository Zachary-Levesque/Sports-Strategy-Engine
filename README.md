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

- Add a FastAPI layer so a frontend can request recommendations over HTTP
- Port the Monte Carlo core into C++ for higher simulation throughput
- Add a React/TypeScript UI for profile editing, hole selection, and visual strategy comparison
- Extend the continuation model into multi-shot planning and richer lie/elevation handling
