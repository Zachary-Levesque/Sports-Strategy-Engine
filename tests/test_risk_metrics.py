from risk_metrics import compute_risk_adjusted_score, risk_profile_for_tolerance


def test_low_risk_penalizes_variance_and_penalties_more():
    low = compute_risk_adjusted_score(4.0, 0.6, 0.1, "low")
    high = compute_risk_adjusted_score(4.0, 0.6, 0.1, "high")
    assert low > high


def test_risk_profiles_are_ordered_sensibly():
    low = risk_profile_for_tolerance("low")
    medium = risk_profile_for_tolerance("medium")
    high = risk_profile_for_tolerance("high")
    assert low.penalty_weight > medium.penalty_weight > high.penalty_weight
