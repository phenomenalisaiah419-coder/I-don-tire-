from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..av_timeline import build_av_plan

router=APIRouter()
class TimelineBody(BaseModel):
    operations:list[dict]

@router.post("/plan")
def plan(b:TimelineBody):
    try:return build_av_plan(b.operations)
    except ValueError as e:raise HTTPException(400,str(e))
