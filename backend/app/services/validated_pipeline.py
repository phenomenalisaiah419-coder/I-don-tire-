"""Strict Edit Plan validation and execution gate.

Validation is deliberately conservative: an operation must be structurally valid,
registered as supported, and contain only safe server-side fields. Execution is
never claimed complete unless the canonical executor returns a result.
"""
from copy import deepcopy
from .canonical_executor import execute_operation
from ..capability_registry import supported_operations

SCHEMA="1.0"
MAX_OPERATIONS=500
ALLOWED_TRACKS={"video","audio","overlay","subtitle"}

def _registered_operations(capabilities):
    if capabilities is None:return supported_operations()
    if isinstance(capabilities,dict) and isinstance(capabilities.get("operations"),list):
        return {str(x) for x in capabilities["operations"]}
    if isinstance(capabilities,dict):
        explicit={str(k) for k,v in capabilities.items() if v is True}
        return explicit | supported_operations()
    return supported_operations()

def _validate_number(v,name,minimum=0):
    if v is None:return
    try:x=float(v)
    except (TypeError,ValueError):raise ValueError(f"{name} must be numeric")
    if x<minimum:raise ValueError(f"{name} cannot be below {minimum}")

def validate_plan(plan,capabilities=None):
    if not isinstance(plan,dict):
        raise ValueError("Unsupported Edit Plan schema")
    if plan.get("schema_version") not in (None, "1.1", SCHEMA):
        raise ValueError("Unsupported Edit Plan schema")
    ops=plan.get("operations")
    if not isinstance(ops,list) or not ops:
        raise ValueError("Edit Plan operations must be a non-empty list")
    if len(ops)>MAX_OPERATIONS:
        raise ValueError(f"Edit Plan exceeds maximum of {MAX_OPERATIONS} operations")

    registered=_registered_operations(capabilities)
    checked=[]
    for raw in ops:
        if not isinstance(raw,dict):raise ValueError("Every operation must be an object")
        name=str(raw.get("operation","")).strip()
        if not name:raise ValueError("Every operation must have an operation name")
        if name not in registered:
            raise ValueError(f"Operation not enabled by capability registry: {name}")
        track=str(raw.get("track","video"))
        if track not in ALLOWED_TRACKS:raise ValueError(f"Unsupported track: {track}")

        op=deepcopy(raw)
        op["operation"]=name;op["track"]=track
        for key in ("start","end","duration","at","x","y","width","height","opacity","speed"):
            if key in op:_validate_number(op[key],key)
        if "start" in op and "end" in op and op["end"]<=op["start"]:
            raise ValueError("Operation end must be greater than start")
        if name in {"trim","cut","delete_range","fade","crossfade","dissolve","audio_fade"} and not op.get("input_path") and name not in {"crossfade","dissolve"}:
            raise ValueError(f"{name} requires a server-resolved input_path")
        checked.append(op)
    return {"schema_version":SCHEMA,"operations":checked}

def execute_validated_plan(plan,capabilities=None):
    validated=validate_plan(plan,capabilities)
    results=[]
    for op in validated["operations"]:
        result=execute_operation(op)
        if not isinstance(result,dict) or result.get("status") not in {"COMPLETED","PLANNED"}:
            raise RuntimeError(f"Operation did not complete: {op.get('operation')}")
        results.append(result)
    return {"status":"COMPLETED","schema_version":SCHEMA,"results":results}
