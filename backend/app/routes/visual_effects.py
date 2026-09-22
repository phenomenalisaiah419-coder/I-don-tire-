from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..visual_effects import scale,crop,rotate,opacity_overlay,fade

router=APIRouter()

class ScaleBody(BaseModel):
    input_path:str; output_path:str; width:int; height:int

class CropBody(BaseModel):
    input_path:str; output_path:str; width:int; height:int; x:int=0; y:int=0

class RotateBody(BaseModel):
    input_path:str; output_path:str; degrees:int

@router.post("/scale")
def scale_api(b:ScaleBody):
    try:return {"status":"COMPLETED","output_path":scale(b.input_path,b.output_path,b.width,b.height)}
    except ValueError as e:raise HTTPException(400,str(e))
    except Exception:raise HTTPException(500,"Scale failed")

@router.post("/crop")
def crop_api(b:CropBody):
    try:return {"status":"COMPLETED","output_path":crop(b.input_path,b.output_path,b.width,b.height,b.x,b.y)}
    except ValueError as e:raise HTTPException(400,str(e))
    except Exception:raise HTTPException(500,"Crop failed")

@router.post("/rotate")
def rotate_api(b:RotateBody):
    try:return {"status":"COMPLETED","output_path":rotate(b.input_path,b.output_path,b.degrees)}
    except ValueError as e:raise HTTPException(400,str(e))
    except Exception:raise HTTPException(500,"Rotate failed")
