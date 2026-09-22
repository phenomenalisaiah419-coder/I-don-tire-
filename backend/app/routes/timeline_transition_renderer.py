from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..services.timeline_transition_renderer import render

router=APIRouter()
class Body(BaseModel):
    clips:list[dict]
    output_path:str

@router.post("/render")
def render_timeline(b:Body):
    try:return {"status":"COMPLETED","output_path":render(b.clips,b.output_path)}
    except ValueError as e:raise HTTPException(400,str(e))
    except Exception:raise HTTPException(500,"Timeline transition rendering failed")
