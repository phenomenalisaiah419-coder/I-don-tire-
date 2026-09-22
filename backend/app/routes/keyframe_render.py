from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..keyframe_render import animate_opacity
router=APIRouter()
class OpacityBody(BaseModel):
    input_path:str; output_path:str; points:list[dict]
@router.post("/opacity")
def opacity(b:OpacityBody):
    try:return {"status":"COMPLETED","output_path":animate_opacity(b.input_path,b.output_path,b.points)}
    except (ValueError,KeyError) as e: raise HTTPException(400,str(e))
    except Exception as e: raise HTTPException(500,"Keyframe rendering failed")
