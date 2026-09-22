import json
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import EditPlan, Project, MediaAsset, OperationLog, User
from ..schemas import EditPlanRequest
from ..security import get_current_user
from ..capability_registry import is_operation_supported, supported_operations
from ..media_engine import execute_operation, ensure_ffmpeg

router = APIRouter()


def _owned(db: Session, project_id: int, user_id: int) -> Project:
    project = db.get(Project, project_id)
    if not project or project.owner_id != user_id:
        raise HTTPException(404, "Project not found")
    return project


def _validate_operations(body: EditPlanRequest):
    supported = supported_operations()
    for index, op in enumerate(body.operations):
        if not is_operation_supported(op.operation):
            raise HTTPException(400, f"Unsupported operation at {index}: {op.operation}. Supported: {sorted(supported)}")
        if op.operation in ("trim", "cut") and (
            op.start is None or op.end is None or op.start < 0 or op.end <= op.start
        ):
            raise HTTPException(400, f"Invalid trim/cut range at operation {index}")
    return supported


@router.post("/validate")
def validate_plan(body: EditPlanRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _owned(db, body.project_id, user.id)
    supported = _validate_operations(body)
    prior = db.query(EditPlan).filter(EditPlan.project_id == body.project_id).count()
    plan = EditPlan(project_id=body.project_id, version=prior + 1, status="VALIDATED", plan_json=body.model_dump_json())
    db.add(plan)
    db.commit(); db.refresh(plan)
    return {"id": plan.id, "version": plan.version, "status": plan.status,
            "operations_count": len(body.operations), "supported_ops": sorted(supported)}


@router.get("/project/{project_id}")
def list_plans(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _owned(db, project_id, user.id)
    plans = db.query(EditPlan).filter(EditPlan.project_id == project_id).order_by(EditPlan.version.desc()).all()
    return [{"id": p.id, "version": p.version, "status": p.status,
             "created_at": p.created_at.isoformat() if p.created_at else None} for p in plans]


@router.get("/{plan_id}")
def get_plan(plan_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    plan = db.get(EditPlan, plan_id)
    if not plan: raise HTTPException(404, "Edit Plan not found")
    _owned(db, plan.project_id, user.id)
    return {"id": plan.id, "project_id": plan.project_id, "version": plan.version,
            "status": plan.status, "plan": json.loads(plan.plan_json),
            "operations": [{"sequence": o.sequence, "operation": o.operation, "status": o.status,
                            "asset_id": o.asset_id, "input_asset_ids": o.input_asset_ids,
                            "output_asset_id": o.output_asset_id, "error": o.error}
                           for o in db.query(OperationLog).filter(OperationLog.plan_id == plan.id).order_by(OperationLog.sequence).all()]}


@router.post("/{plan_id}/execute")
def execute_plan(plan_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    plan = db.get(EditPlan, plan_id)
    if not plan: raise HTTPException(404, "Edit Plan not found")
    project = _owned(db, plan.project_id, user.id)
    if plan.status not in ("VALIDATED", "FAILED"):
        raise HTTPException(409, f"Plan cannot be executed from status {plan.status}")
    if not ensure_ffmpeg():
        raise HTTPException(503, "FFmpeg not available on this host")

    payload = json.loads(plan.plan_json)
    operations = payload.get("operations", [])
    if not operations:
        raise HTTPException(400, "Edit Plan contains no operations")

    plan.status = "PROCESSING"
    db.commit()
    current_asset_id = None
    outputs = []
    try:
        for seq, op in enumerate(operations, start=1):
            op_name = op["operation"]
            asset_id = op.get("asset_id") or current_asset_id
            if not asset_id:
                raise ValueError(f"Operation {seq} requires asset_id")
            asset = db.get(MediaAsset, asset_id)
            if not asset or asset.project_id != project.id:
                raise ValueError(f"Operation {seq} references an invalid project asset")
            output = os.path.join(os.path.dirname(asset.path) or ".", f"{uuid.uuid4().hex}_op{seq}.mp4")
            log = OperationLog(project_id=project.id, plan_id=plan.id, sequence=seq,
                               operation=op_name, asset_id=asset.id, input_asset_ids=[asset.id],
                               params_json=op.get("params") or {}, status="PROCESSING",
                               reason=payload.get("intent", ""))
            db.add(log); db.commit(); db.refresh(log)
            execute_operation(op_name, asset.path, output, op.get("params") or {})
            new_asset = MediaAsset(project_id=project.id, filename=os.path.basename(output),
                                   path=output, mime_type="video/mp4", size_bytes=os.path.getsize(output),
                                   metadata_json={"derived_from": [asset.id], "operation": op_name}, sha256="")
            db.add(new_asset); db.flush()
            log.output_asset_id = new_asset.id
            log.status = "COMPLETED"
            current_asset_id = new_asset.id
            outputs.append(new_asset.id)
            db.commit()

        state = dict(project.state_json or {})
        state.setdefault("operations", [])
        state["operations"].append({"plan_id": plan.id, "version": plan.version, "output_asset_id": current_asset_id})
        project.version += 1
        project.state_json = state
        plan.status = "COMPLETED"
        db.commit()
        return {"plan_id": plan.id, "status": plan.status, "output_asset_id": current_asset_id,
                "output_asset_ids": outputs}
    except Exception as exc:
        plan.status = "FAILED"
        db.query(OperationLog).filter(OperationLog.plan_id == plan.id, OperationLog.status == "PROCESSING").update({"status": "FAILED", "error": str(exc)})
        db.commit()
        raise HTTPException(500, f"Edit Plan execution failed: {exc}") from exc


@router.get("/{plan_id}/operations")
def operation_log(plan_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    plan = db.get(EditPlan, plan_id)
    if not plan: raise HTTPException(404, "Edit Plan not found")
    _owned(db, plan.project_id, user.id)
    return [{"id": o.id, "sequence": o.sequence, "operation": o.operation, "status": o.status,
             "asset_id": o.asset_id, "input_asset_ids": o.input_asset_ids,
             "output_asset_id": o.output_asset_id, "params": o.params_json,
             "reason": o.reason, "error": o.error,
             "created_at": o.created_at.isoformat() if o.created_at else None}
            for o in db.query(OperationLog).filter(OperationLog.plan_id == plan_id).order_by(OperationLog.sequence).all()]
