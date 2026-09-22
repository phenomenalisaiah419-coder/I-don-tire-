"""AI Director orchestration.

The Director is responsible for gathering verified project evidence, asking a configured
provider for a structured plan, validating that plan, and handing it to the canonical
Edit Plan executor. It never executes arbitrary model output.
"""
from dataclasses import dataclass
from typing import Protocol

class DirectorProvider(Protocol):
    async def create_plan(self, context: dict, instruction: str) -> dict: ...

@dataclass
class DirectorContext:
    project: dict
    media: list[dict]
    capabilities: dict
    evidence: dict

def validate_director_plan(plan: dict) -> None:
    if not isinstance(plan, dict):
        raise ValueError("AI Director response must be an object")
    if plan.get("schema_version") != "1.0":
        raise ValueError("Unsupported Edit Plan schema")
    if not isinstance(plan.get("operations"), list):
        raise ValueError("Edit Plan operations must be a list")
    for op in plan["operations"]:
        if not isinstance(op, dict) or not op.get("operation"):
            raise ValueError("Every operation must have an operation name")
        if op.get("asset_id") is not None and not isinstance(op["asset_id"], int):
            raise ValueError("asset_id must be an integer")

async def generate_validated_plan(provider: DirectorProvider, context: DirectorContext, instruction: str) -> dict:
    if not instruction.strip():
        raise ValueError("Editing instruction cannot be empty")
    plan = await provider.create_plan({
        "project": context.project,
        "media": context.media,
        "capabilities": context.capabilities,
        "evidence": context.evidence,
        "constraints": context.project.get("constraints", {}),
    }, instruction)
    validate_director_plan(plan)
    return plan
