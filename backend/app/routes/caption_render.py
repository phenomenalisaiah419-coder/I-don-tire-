from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import tempfile, os, uuid
from ..services.caption_render import build_ass, burn_in

router=APIRouter()

class RenderBody(BaseModel):
    input_path:str
    segments:list[dict]
    style:dict={}

@router.post("/burn-in")
def render(body:RenderBody):
    if not os.path.isfile(body.input_path): raise HTTPException(404,"Input media not found")
    d=tempfile.mkdtemp(prefix="phenova_caption_")
    ass=os.path.join(d,"captions.ass")
    output=os.path.join(d,f"{uuid.uuid4().hex}_captioned.mp4")
    try:
        open(ass,"w",encoding="utf-8").write(build_ass(body.segments,body.style))
        burn_in(body.input_path,ass,output)
        return {"status":"COMPLETED","output_path":output,"subtitle_format":"ASS"}
    except ValueError as e: raise HTTPException(400,str(e))
    except Exception as e: raise HTTPException(500,"Caption rendering failed")
