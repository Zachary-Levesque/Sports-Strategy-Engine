# Architecture

The MVP is a Python-first offline simulation engine.

Core flow:

1. `player_model.py` loads golfer profiles and converts a decision into a landing distribution.
2. `hole_generator.py` loads handcrafted holes and can procedurally create new simplified holes.
3. `decision_engine.py` generates candidate strategies across club, aim point, shape, and swing intensity.
4. `monte_carlo.py` simulates shot outcomes, classifies the landing surface, and estimates strokes remaining with a heuristic continuation model.
5. `risk_metrics.py` computes risk-adjusted scores based on player risk tolerance.
6. `visualize.py` renders the hole and the recommended shot cloud.
7. `prototype.py` ties the pieces together for a local runnable MVP.

The modules are intentionally lightweight and typed so the simulation logic can later be ported into a C++ core while keeping the same domain model.
