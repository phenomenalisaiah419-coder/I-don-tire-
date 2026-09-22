import os, uuid
from fastapi import APIRouter, HTTPException
from ..audio_engine import normalize, denoise, mix, duck_music

router=APIRouter()

@router.post("/normalize")
def audio_normalize(input_path:str):
    output=os.path.join(os.path.dirname(input_path),f"{uuid.uuid4().hex}_normalized.m4a")
    try: normalize(input_path,output)
    except Exception as e: raise HTTPException(500,"Audio normalization failed")
    return {"status":"COMPLETED","output_path":output}

@router.post("/denoise")
def audio_denoise(input_path:str):
    output=os.path.join(os.path.dirname(input_path),f"{uuid.uuid4().hex}_denoised.m4a")
    try: denoise(input_path,output)
    except Exception: raise HTTPException(500,"Audio denoise failed")
    return {"status":"COMPLETED","output_path":output}

@router.post("/mix")
def audio_mix(input_paths:list[str]):
    output=os.path.join(os.path.dirname(input_paths[0]),f"{uuid.uuid4().hex}_mix.m4a")
    try: mix(input_paths,output)
    except Exception: raise HTTPException(500,"Audio mix failed")
    return {"status":"COMPLETED","output_path":output}
