"""AI Director correction loop over canonical Edit Plans."""
from dataclasses import dataclass

@dataclass(frozen=True)
class CorrectionRequest:
    instruction: str
    previous_plan_id: int | None = None

def build_correction_context(project: dict, media: list[dict], capabilities: dict,
                             evidence: dict, previous_plan: dict | None,
                             correction: str) -> dict:
    if not correction.strip():
        raise ValueError("Correction instruction cannot be empty")
    return {
        "project": project,
        "media": media,
        "capabilities": capabilities,
        "evidence": evidence,
        "previous_plan": previous_plan,
        "correction": correction,
        "rule": "Return a complete replacement Edit Plan; never mutate media outside the canonical executor."
    }
