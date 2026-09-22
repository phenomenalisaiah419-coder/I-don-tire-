from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..position_keyframe_render import animate_position

router=APIRouter()
class PositionBody(BaseModel):
    input_path:str
    output_path:str
    x_points:list[dict]
    y_points:list[dict]
    canvas_width:int=1920
    canvas_height:int=1080

@router.post("/")
def render(b:PositionBody):
    try:
        return {"status":"COMPLETED","output_path":animate_position(
            b.input_path,b.output_path,b.x_points,b.y_points,
            b.canvas_width,b.canvas_height)}
    except ValueError as e: raise HTTPException(400,str(e))
    except Exception: raise HTTPException(500,"Position rendering failed")
