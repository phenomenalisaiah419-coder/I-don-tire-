from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..multitrack_renderer import render_video_with_audio

router=APIRouter()
class MultiTrackBody(BaseModel):
    video_path:str
    audio_paths:list[str]=[]
    output_path:str
    canvas_width:int=1920
    canvas_height:int=1080

@router.post("/")
def render(b:MultiTrackBody):
    try:
        return {"status":"COMPLETED","output_path":render_video_with_audio(
            b.video_path,b.audio_paths,b.output_path,b.canvas_width,b.canvas_height)}
    except ValueError as e: raise HTTPException(400,str(e))
    except Exception: raise HTTPException(500,"Multi-track rendering failed")
