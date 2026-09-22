from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel,Field
from ..models import User
from ..security import get_current_user
from ..services.canonical_timeline import apply_operations,normalize
from ..services.timeline_snapshot import latest,save

router=APIRouter()

class TimelineOperationRequest(BaseModel):
    project_id:int
    operations:list[dict]
    base_version:int|None=None
    reason:str=Field(default="timeline-edit",max_length=500)

@router.get("/{project_id}")
def get_timeline(project_id:int,user:User=Depends(get_current_user)):
    # Project ownership must be enforced by the project's existing authorization layer
    # before production exposure; this endpoint only addresses timeline persistence.
    current=latest(project_id)
    return current or {"version":0,"state":normalize({}),"created_at":None,"reason":"initial"}

@router.post("/apply")
def apply(body:TimelineOperationRequest,user:User=Depends(get_current_user)):
    current=latest(body.project_id)
    current_version=current["version"] if current else 0
    if body.base_version is not None and body.base_version!=current_version:
        raise HTTPException(409,"Timeline changed; refresh before applying this edit")
    state=current["state"] if current else normalize({})
    try:
        updated=apply_operations(state,body.operations)
        version=save(body.project_id,updated,body.reason)
        return {"version":version,"state":updated}
    except ValueError as e:
        raise HTTPException(400,str(e))
