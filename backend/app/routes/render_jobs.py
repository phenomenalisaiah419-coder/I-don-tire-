from fastapi import APIRouter,Depends,HTTPException,Query
from pydantic import BaseModel
from ..models import User
from ..security import get_current_user
from ..services import persistent_render_jobs as jobs
from ..services.render_events import recent
from ..services.editplan_render_pipeline import plan_to_project
from ..services.validated_pipeline import validate_plan
from ..config import settings
import os,uuid

router=APIRouter()

class CreateRenderJob(BaseModel):
    plan:dict
    capabilities:dict={}

@router.post("")
def create_job(body:CreateRenderJob,user:User=Depends(get_current_user)):
    try:
        validated=validate_plan(body.plan,body.capabilities)
        plan_to_project(validated)
    except ValueError as e:
        raise HTTPException(400,str(e))
    out_dir=os.path.join(settings.media_root,"renders",str(user.id))
    os.makedirs(out_dir,exist_ok=True)
    output=os.path.join(out_dir,f"{uuid.uuid4().hex}.mp4")
    jid=jobs.create(str(user.id),validated,output)
    return {"job_id":jid,"status":"QUEUED","progress":0}

@router.get("/{job_id}")
def get_job(job_id:str,user:User=Depends(get_current_user)):
    result=jobs.get(job_id,str(user.id))
    if not result: raise HTTPException(404,"Render job not found")
    result.pop("plan",None)
    # Never expose internal worker identifiers or filesystem paths to the client.
    result.pop("worker_id",None)
    result.pop("output_path",None)
    return result

@router.get("/{job_id}/events")
def get_events(job_id:str,limit:int=Query(50,ge=1,le=100),user:User=Depends(get_current_user)):
    result=jobs.get(job_id,str(user.id))
    if not result: raise HTTPException(404,"Render job not found")
    return {"job_id":job_id,"events":recent(job_id,limit)}

@router.post("/{job_id}/cancel")
def cancel(job_id:str,user:User=Depends(get_current_user)):
    if not jobs.request_cancel(job_id,str(user.id)):
        raise HTTPException(409,"Render job cannot be cancelled in its current state")
    current=jobs.get(job_id,str(user.id))
    return {"cancel_requested":True,"job_id":job_id,
            "status":current["status"] if current else "CANCELLED"}

@router.post("/recover")
def recover(user:User=Depends(get_current_user)):
    # Recovery is idempotent and only affects stale jobs; deployment-level
    # authorization should still restrict this maintenance endpoint if exposed.
    return {"recovered":jobs.recover_stale()}
