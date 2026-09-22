from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..services.integrated_project_renderer import render

router=APIRouter()
class Body(BaseModel):
    project:dict
    output_path:str

@router.post("/render")
def render_project(b:Body):
    try:return {"status":"COMPLETED","output_path":render(b.project,b.output_path)}
    except ValueError as e:raise HTTPException(400,str(e))
    except Exception:raise HTTPException(500,"Integrated project render failed")
