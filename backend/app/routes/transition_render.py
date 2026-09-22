from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..transition_render import crossfade,dissolve,overlay_layer

router=APIRouter()
class TransitionBody(BaseModel):
    first_path:str; second_path:str; output_path:str; duration:float=1.0; offset:float=0.0
class OverlayBody(BaseModel):
    base_path:str; overlay_path:str; output_path:str; x:int=0; y:int=0; opacity:float=1.0

@router.post("/crossfade")
def crossfade_api(b:TransitionBody):
    try:return {"status":"COMPLETED","output_path":crossfade(b.first_path,b.second_path,b.output_path,b.duration,b.offset)}
    except ValueError as e:raise HTTPException(400,str(e))
    except Exception:raise HTTPException(500,"Crossfade rendering failed")

@router.post("/dissolve")
def dissolve_api(b:TransitionBody):
    try:return {"status":"COMPLETED","output_path":dissolve(b.first_path,b.second_path,b.output_path,b.duration,b.offset)}
    except ValueError as e:raise HTTPException(400,str(e))
    except Exception:raise HTTPException(500,"Dissolve rendering failed")

@router.post("/overlay")
def overlay_api(b:OverlayBody):
    try:return {"status":"COMPLETED","output_path":overlay_layer(b.base_path,b.overlay_path,b.output_path,b.x,b.y,b.opacity)}
    except ValueError as e:raise HTTPException(400,str(e))
    except Exception:raise HTTPException(500,"Layer rendering failed")
