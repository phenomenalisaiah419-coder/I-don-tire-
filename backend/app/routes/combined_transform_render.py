from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..services.combined_transform_render import render

router=APIRouter()
class TransformBody(BaseModel):
    input_path:str
    output_path:str
    canvas_width:int=1920
    canvas_height:int=1080
    x_points:list[dict]|None=None
    y_points:list[dict]|None=None
    scale_points:list[dict]|None=None
    rotation_points:list[dict]|None=None
    opacity_points:list[dict]|None=None

@router.post("/")
def transform(b:TransformBody):
    try:
        return {"status":"COMPLETED","output_path":render(
            b.input_path,b.output_path,b.canvas_width,b.canvas_height,
            b.x_points,b.y_points,b.scale_points,b.rotation_points,b.opacity_points)}
    except ValueError as e: raise HTTPException(400,str(e))
    except Exception: raise HTTPException(500,"Combined transform rendering failed")
