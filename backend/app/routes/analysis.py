import json, os, tempfile
from fastapi import APIRouter, HTTPException
from ..media_understanding import build_evidence_index

router=APIRouter()

@router.post("/evidence-index")
def evidence_index(input_path:str):
    if not os.path.isfile(input_path):
        raise HTTPException(404,"Media file not found")
    out=tempfile.mkdtemp(prefix="phenova_frames_")
    try:
        return build_evidence_index(input_path,out)
    except Exception as exc:
        raise HTTPException(500,"Media evidence extraction failed") from exc
