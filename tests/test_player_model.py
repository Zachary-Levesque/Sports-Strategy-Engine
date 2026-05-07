from player_model import ShotOption, build_shot_distribution, load_player_profiles


def test_load_player_profiles_contains_named_players():
    players = load_player_profiles("data/player_profiles.json")
    assert {"Zachary", "Maya"}.issubset(players.keys())


def test_preferred_shape_tightens_dispersion():
    player = load_player_profiles("data/player_profiles.json")["Zachary"]
    club = player.club_by_name("Driver")
    preferred = build_shot_distribution(
        player, club, ShotOption("Driver", 0.0, 250.0, "center fairway", "fade", 1.0), "tee", 0.0, 0.0
    )
    non_preferred = build_shot_distribution(
        player, club, ShotOption("Driver", 0.0, 250.0, "center fairway", "draw", 1.0), "tee", 0.0, 0.0
    )
    assert preferred.sigma_x < non_preferred.sigma_x


def test_crosswind_moves_landing_mean():
    player = load_player_profiles("data/player_profiles.json")["Zachary"]
    club = player.club_by_name("6-Iron")
    calm = build_shot_distribution(
        player, club, ShotOption("6-Iron", 0.0, 180.0, "center green", "straight", 1.0), "tee", 0.0, 0.0
    )
    windy = build_shot_distribution(
        player, club, ShotOption("6-Iron", 0.0, 180.0, "center green", "straight", 1.0), "tee", 15.0, 90.0
    )
    assert windy.mean_x > calm.mean_x
