from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..services.render_graph_executor import execute_graph

router=APIRouter()
class ExecuteGraphBody(BaseModel):
    graph:dict
    output_path:str

@router.post("/execute")
def execute(body:ExecuteGraphBody):
    try:return {"status":"COMPLETED","output_path":execute_graph(body.graph,body.output_path)}
    except ValueError as e:raise HTTPException(400,str(e))
    except Exception:raise HTTPException(500,"Render graph execution failed")
