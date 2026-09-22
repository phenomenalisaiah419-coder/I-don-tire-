from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..services.transcript_sync import segment_to_operation, sync_change

router=APIRouter()

class SegmentBody(BaseModel):
    id:int; start:float; end:float; asset_id:int|None=None

class SyncBody(BaseModel):
    segment:dict
    new_start:float|None=None
    new_end:float|None=None

@router.post("/operation")
def operation(body:SegmentBody, action:str="remove"):
    try:return segment_to_operation(body.model_dump(),action)
    except ValueError as e:raise HTTPException(400,str(e))

@router.post("/change")
def change(body:SyncBody):
    try:return sync_change(body.segment,body.new_start,body.new_end)
    except ValueError as e:raise HTTPException(400,str(e))
