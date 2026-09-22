import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import Project, MediaAsset, EditPlan, User
from ..schemas import DirectorRequest, EditOperation, EditPlanRequest
from ..security import get_current_user
from ..providers import get_ai_provider
from ..capability_registry import supported_operations, is_operation_supported

router=APIRouter()

def owned(db, project_id, user_id):
    p=db.get(Project, project_id)
    if not p or p.owner_id != user_id: raise HTTPException(404,"Project not found")
    return p

@router.post('/plan')
async def create_plan(body: DirectorRequest, db: Session=Depends(get_db), user: User=Depends(get_current_user)):
    project=owned(db,body.project_id,user.id)
    assets=db.query(MediaAsset).filter(MediaAsset.project_id==project.id).all()
    context={"project":{"id":project.id,"name":project.name,"version":project.version,"state":project.state_json or {}},
             "assets":[{"id":a.id,"filename":a.filename,"mime_type":a.mime_type,"duration":a.duration,"metadata":a.metadata_json or {}} for a in assets],
             "capabilities":sorted(supported_operations())}
    try:
        result=await get_ai_provider().create_edit_plan(context,body.instruction)
    except Exception as exc:
        raise HTTPException(503,f"AI planning unavailable: {exc}") from exc
    try:
        operations=result.get("operations")
        intent=result.get("intent",body.instruction)
        if not isinstance(operations,list): raise ValueError("AI response has no operations array")
        ops=[]
        for raw in operations:
            if not isinstance(raw,dict) or not is_operation_supported(str(raw.get("operation",""))):
                raise ValueError(f"Unsupported operation in AI plan: {raw.get('operation') if isinstance(raw,dict) else raw}")
            asset_id=raw.get("asset_id")
            if asset_id is not None and not any(a.id==asset_id for a in assets): raise ValueError(f"Unknown asset_id: {asset_id}")
            ops.append(EditOperation(operation=raw["operation"],asset_id=asset_id,start=raw.get("start"),end=raw.get("end"),params=raw.get("params") or {}))
        if not ops: raise HTTPException(422,"The AI could not produce an executable edit plan for this request")
        body_plan=EditPlanRequest(project_id=project.id,operations=ops,intent=intent)
    except HTTPException: raise
    except Exception as exc:
        raise HTTPException(502,f"AI returned an invalid edit plan: {exc}") from exc
    prior=db.query(EditPlan).filter(EditPlan.project_id==project.id).count()
    plan=EditPlan(project_id=project.id,version=prior+1,status="VALIDATED",plan_json=body_plan.model_dump_json())
    db.add(plan); db.commit(); db.refresh(plan)
    return {"id":plan.id,"version":plan.version,"status":plan.status,"intent":intent,"operations":[o.model_dump() for o in ops]}
