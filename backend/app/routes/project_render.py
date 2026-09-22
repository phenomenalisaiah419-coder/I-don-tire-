import os,uuid
from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import User
from ..security import get_current_user
from ..config import settings
from ..services.project_timeline_render import timeline_to_plan
from ..services.editplan_render_pipeline import plan_to_project
from ..services import persistent_render_jobs as jobs

router=APIRouter()

class TimelineRenderRequest(BaseModel):
    capabilities:dict={}

@router.post("/{project_id}/render")
def render_project(project_id:int,body:TimelineRenderRequest,db:Session=Depends(get_db),
                   user:User=Depends(get_current_user)):
    try:
        plan=timeline_to_plan(db,project_id,user.id,body.capabilities)
        plan_to_project(plan)
    except ValueError as e:
        raise HTTPException(400,str(e))

    out_dir=os.path.join(settings.media_root,"renders",str(user.id),str(project_id))
    os.makedirs(out_dir,exist_ok=True)
    output=os.path.join(out_dir,f"{uuid.uuid4().hex}.mp4")
    jid=jobs.create(str(user.id),plan,output)
    return {"job_id":jid,"status":"QUEUED","progress":0,"project_id":project_id}
