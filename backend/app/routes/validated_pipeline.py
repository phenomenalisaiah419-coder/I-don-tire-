from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..validated_pipeline import validate_plan, execute_validated_plan

router=APIRouter()
class PlanBody(BaseModel):
    plan:dict
    capabilities:dict={}

@router.post("/validate")
def validate(b:PlanBody):
    try:return validate_plan(b.plan,b.capabilities)
    except ValueError as e:raise HTTPException(400,str(e))

@router.post("/execute")
def execute(b:PlanBody):
    try:return execute_validated_plan(b.plan,b.capabilities)
    except ValueError as e:raise HTTPException(400,str(e))
    except Exception:raise HTTPException(500,"Validated plan execution failed")
