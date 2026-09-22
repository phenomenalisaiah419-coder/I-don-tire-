"""Non-destructive execution/version orchestration."""
from datetime import datetime, timezone
from uuid import uuid4

def execute_versioned_plan(project_id:int, plan:dict, previous_version_id:int|None=None) -> dict:
    if not isinstance(plan,dict) or plan.get("schema_version")!="1.0":
        raise ValueError("Only validated Edit Plan schema 1.0 can execute")
    ops=plan.get("operations")
    if not isinstance(ops,list):
        raise ValueError("Edit Plan operations must be a list")
    version_id=str(uuid4())
    return {
        "version_id":version_id,
        "project_id":project_id,
        "parent_version_id":previous_version_id,
        "status":"READY_FOR_CANONICAL_EXECUTOR",
        "created_at":datetime.now(timezone.utc).isoformat(),
        "operation_count":len(ops),
    }
