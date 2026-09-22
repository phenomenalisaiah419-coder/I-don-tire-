from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..services.versioned_execution import execute_versioned_plan

router=APIRouter()

class ExecuteBody(BaseModel):
    project_id:int
    plan:dict
    previous_version_id:int|None=None

@router.post("/prepare")
def prepare_execution(body:ExecuteBody):
    try:
        return execute_versioned_plan(body.project_id,body.plan,body.previous_version_id)
    except ValueError as exc:
        raise HTTPException(400,str(exc))
