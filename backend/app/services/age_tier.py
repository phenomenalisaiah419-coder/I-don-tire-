"""
Age tier enforcement for media analysis and AI Director.
Under-18 receives restricted analysis limits and stricter content policy.
"""
from enum import Enum

class AgeTier(str, Enum):
    BLOCKED = "blocked"      # under 13 where required
    RESTRICTED = "restricted"  # 13-17
    ADULT = "adult"          # 18+

def tier_from_age(age: int | None) -> AgeTier:
    if age is None:
        return AgeTier.RESTRICTED  # safe default
    if age < 13:
        return AgeTier.BLOCKED
    if age < 18:
        return AgeTier.RESTRICTED
    return AgeTier.ADULT

def analysis_allowed(tier: AgeTier, analysis_type: str) -> bool:
    """Stricter limits for under-18 on face/speaker indexing etc."""
    if tier == AgeTier.BLOCKED:
        return False
    if tier == AgeTier.RESTRICTED:
        # Allow basic duration/scene/silence; restrict face/speaker identity features
        restricted = {"face_identity", "speaker_identity", "location_inference"}
        return analysis_type not in restricted
    return True
