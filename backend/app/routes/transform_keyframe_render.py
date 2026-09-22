from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..transform_keyframe_render import animate_transform

router=APIRouter()
class TransformBody(BaseModel):
    input_path:str
    output_path:str
    position_x:list[dict]|None=None
    position_y:list[dict]|None=None
    scale:list[dict]|None=None
    rotation:list[dict]|None=None

@router.post("/")
def render(b:TransformBody):
    try:
        return {"status":"COMPLETED","output_path":animate_transform(
            b.input_path,b.output_path,b.position_x,b.position_y,b.scale,b.rotation)}
    except ValueError as e: raise HTTPException(400,str(e))
    except Exception: raise HTTPException(500,"Transform rendering failed")
