"""
AI Director hard budgets — mandatory enforcement from Hardened Competitive + Position A spec.
Rejects plans that exceed operations, media minutes, concurrency or estimated cost.
"""
from dataclasses import dataclass
from typing import Optional

@dataclass
class DirectorBudget:
    max_operations: int = 40
    max_media_minutes: float = 30.0
    max_concurrent_jobs_per_user: int = 2
    max_estimated_cost_units: float = 100.0

DEFAULT_BUDGET = DirectorBudget()
PREMIUM_BUDGET = DirectorBudget(max_operations=120, max_media_minutes=120.0, max_concurrent_jobs_per_user=4, max_estimated_cost_units=500.0)

def budget_for_plan(plan: str) -> DirectorBudget:
    if plan in ("plus", "pro", "premium", "pro100", "pro200"):
        return PREMIUM_BUDGET
    return DEFAULT_BUDGET

def validate_plan_against_budget(
    operation_count: int,
    media_minutes: float,
    estimated_cost: float,
    current_concurrent: int,
    user_plan: str = "free",
) -> tuple[bool, Optional[str]]:
    b = budget_for_plan(user_plan)
    if operation_count > b.max_operations:
        return False, f"AI Director plan exceeds max operations ({operation_count} > {b.max_operations})"
    if media_minutes > b.max_media_minutes:
        return False, f"AI Director plan exceeds max media minutes ({media_minutes:.1f} > {b.max_media_minutes})"
    if current_concurrent >= b.max_concurrent_jobs_per_user:
        return False, f"Too many concurrent AI Director jobs (limit {b.max_concurrent_jobs_per_user})"
    if estimated_cost > b.max_estimated_cost_units:
        return False, f"Estimated cost exceeds budget ({estimated_cost} > {b.max_estimated_cost_units})"
    return True, None
