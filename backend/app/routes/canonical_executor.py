from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..services.canonical_executor import execute_operation

router=APIRouter()
class ExecuteBody(BaseModel):
    operation:dict

@router.post("/operation")
def execute(body:ExecuteBody):
    try:return execute_operation(body.operation)
    except KeyError as e:raise HTTPException(400,f"Missing operation field: {e.args[0]}")
    except ValueError as e:raise HTTPException(400,str(e))
    except Exception:raise HTTPException(500,"Canonical execution failed")
