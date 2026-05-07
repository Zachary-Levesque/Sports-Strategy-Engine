# Math Model

The MVP uses a 2D Gaussian landing model.

- Mean downrange distance starts from club carry scaled by swing intensity.
- Mean lateral position starts from the selected aim point.
- Swing intensity scales both distance and dispersion.
- Confidence widens dispersion for less reliable clubs.
- Preferred shot shape slightly tightens dispersion.
- Shot shape adds a lateral bias.
- Miss tendency adds a smaller lateral bias.
- Wind applies a carry adjustment from the head/tail component and a lateral adjustment from the crosswind component.

For each simulated shot:

1. Sample `(x, y)` from the shot distribution.
2. Classify the landing point as `fairway`, `rough`, `green`, `bunker`, `water`, `ob`, or `recovery`.
3. Estimate strokes remaining with a lie-aware heuristic based on distance to the hole.
4. Total strokes for the option are `1 + penalty + strokes_remaining`.

Risk-adjusted score:

`expected_strokes + lambda * variance + penalty_weight * penalty_probability`

The `lambda` and `penalty_weight` values depend on the selected risk tolerance.
