from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..services.timeline_transition_chain import compile_chain

router=APIRouter()
class Body(BaseModel):
    clips:list[dict]

@router.post("/compile")
def compile(b:Body):
    try:return compile_chain(b.clips)
    except ValueError as e:raise HTTPException(400,str(e))
