from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..services.editplan_render_pipeline import render_edit_plan

router=APIRouter()
class Body(BaseModel):
    plan:dict
    output_path:str
    capabilities:dict={}

@router.post("/render")
def render_plan(b:Body):
    try:
        return {"status":"COMPLETED","output_path":render_edit_plan(
            b.plan,b.output_path,b.capabilities)}
    except ValueError as e: raise HTTPException(400,str(e))
    except Exception: raise HTTPException(500,"Edit Plan render failed")
