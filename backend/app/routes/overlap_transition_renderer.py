from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..services.overlap_transition_renderer import render

router=APIRouter()
class Body(BaseModel):
    first_path:str; second_path:str; output_path:str
    transition:str="dissolve"; overlap:float=1.0

@router.post("/")
def transition(b:Body):
    try:return {"status":"COMPLETED","output_path":render(
        b.first_path,b.second_path,b.output_path,b.transition,b.overlap)}
    except ValueError as e:raise HTTPException(400,str(e))
    except Exception:raise HTTPException(500,"Overlap transition rendering failed")
