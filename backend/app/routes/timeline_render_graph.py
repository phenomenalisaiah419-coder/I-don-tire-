from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..services.timeline_render_graph import compile_graph

router=APIRouter()

class GraphBody(BaseModel):
    plan:dict

@router.post("/compile")
def compile(body:GraphBody):
    try:return compile_graph(body.plan)
    except ValueError as e:raise HTTPException(400,str(e))
