from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..compositing import transition,layer,keyframes

router=APIRouter()
class TransitionBody(BaseModel):
    name:str; duration:float
class LayerBody(BaseModel):
    asset_id:int; track:int; start:float; end:float; opacity:float=1.0
class KeyframeBody(BaseModel):
    property_name:str; points:list[dict]

@router.post("/transition")
def transition_api(b:TransitionBody):
    try:return transition(b.name,b.duration)
    except ValueError as e:raise HTTPException(400,str(e))
@router.post("/layer")
def layer_api(b:LayerBody):
    try:return layer(b.asset_id,b.track,b.start,b.end,b.opacity)
    except ValueError as e:raise HTTPException(400,str(e))
@router.post("/keyframes")
def keyframes_api(b:KeyframeBody):
    try:return keyframes(b.property_name,b.points)
    except (KeyError,ValueError) as e:raise HTTPException(400,str(e))
