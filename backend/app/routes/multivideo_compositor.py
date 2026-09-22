from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..services.multivideo_compositor import render

router=APIRouter()
class VideoNode(BaseModel):
    input:str; start:float; end:float; x:int=0; y:int=0
class Body(BaseModel):
    nodes:list[VideoNode]
    output_path:str
    width:int=1920
    height:int=1080

@router.post("/")
def compose(b:Body):
    try:
        return {"status":"COMPLETED","output_path":render(
            [n.model_dump() for n in b.nodes],b.output_path,b.width,b.height)}
    except ValueError as e: raise HTTPException(400,str(e))
    except Exception: raise HTTPException(500,"Multi-video composition failed")
