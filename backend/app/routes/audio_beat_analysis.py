import os
from fastapi import APIRouter, HTTPException
from ..services.audio_beat_analysis import detect_silence, detect_beats

router = APIRouter()


@router.post("/silence")
async def analyze_silence(input_path: str, threshold_db: float = -40.0, min_length_sec: float = 0.5):
    if not os.path.isfile(input_path):
        raise HTTPException(404, "Input file not found")
    try:
        regions = await detect_silence(input_path, threshold_db, min_length_sec)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    return {"status": "COMPLETED", "silence_regions": regions}


@router.post("/beats")
async def analyze_beats(input_path: str):
    if not os.path.isfile(input_path):
        raise HTTPException(404, "Input file not found")
    try:
        result = await detect_beats(input_path)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    return {"status": "COMPLETED", **result}
