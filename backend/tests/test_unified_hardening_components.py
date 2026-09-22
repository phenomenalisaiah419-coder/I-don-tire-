from backend.app.services.age_tier import AgeTier, tier_from_age, analysis_allowed
from backend.app.services.ai_director_budgets import budget_for_plan, validate_plan_against_budget

def test_age_tier_defaults_and_restrictions():
    assert tier_from_age(None) == AgeTier.RESTRICTED
    assert tier_from_age(17) == AgeTier.RESTRICTED
    assert tier_from_age(18) == AgeTier.ADULT
    assert not analysis_allowed(AgeTier.RESTRICTED, "face_identity")
    assert analysis_allowed(AgeTier.RESTRICTED, "silence")

def test_director_budget_enforcement():
    ok, reason = validate_plan_against_budget(10, 5, 10, 0, "free")
    assert ok and reason is None
    ok, reason = validate_plan_against_budget(41, 5, 10, 0, "free")
    assert not ok
    assert "max operations" in reason.lower()
    assert budget_for_plan("premium").max_operations == 120
