from hole_generator import classify_surface, generate_hole, load_holes


def test_generate_hole_returns_valid_geometry():
    hole = generate_hole(par=4, seed=11)
    assert hole.par == 4
    assert hole.yardage >= 345
    assert hole.fairway_end_y > hole.fairway_start_y
    assert any(hazard.kind == "ob" for hazard in hole.hazards)


def test_sample_hole_surface_classification():
    hole = load_holes("data/generated_holes.json")["harbor_par4"]
    assert classify_surface(hole, 0.0, 200.0) == "fairway"
    assert classify_surface(hole, 25.0, 258.0) == "water"
