from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
from ..services.captions import to_srt, to_vtt, split_for_display

router=APIRouter()

class CaptionBody(BaseModel):
    segments:list[dict]

@router.post("/srt")
def srt(body:CaptionBody):
    try:return Response(content=to_srt(body.segments),media_type="application/x-subrip")
    except ValueError as e:raise HTTPException(400,str(e))

@router.post("/vtt")
def vtt(body:CaptionBody):
    try:return Response(content=to_vtt(body.segments),media_type="text/vtt")
    except ValueError as e:raise HTTPException(400,str(e))

@router.post("/display-lines")
def display_lines(body:dict):
    text=str(body.get("text",""))
    return {"lines":split_for_display(text,int(body.get("max_chars",42)))}
