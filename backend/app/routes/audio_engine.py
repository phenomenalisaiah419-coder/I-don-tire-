from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..audio_engine import mute,set_volume,audio_fade,change_speed,mix_tracks

router=APIRouter()
class SingleBody(BaseModel):
    input_path:str; output_path:str
class VolumeBody(SingleBody): volume:float=1.0
class MuteBody(SingleBody): start:float=0.0; end:float|None=None
class FadeBody(SingleBody): fade_in:float=0.0; fade_out:float=0.0; duration:float|None=None
class SpeedBody(SingleBody): speed:float=1.0
class MixBody(BaseModel):
    input_paths:list[str]; output_path:str; weights:list[float]|None=None

@router.post("/mute")
def mute_api(b:MuteBody):
    try:return {"status":"COMPLETED","output_path":mute(b.input_path,b.output_path,b.start,b.end)}
    except ValueError as e:raise HTTPException(400,str(e))
    except Exception:raise HTTPException(500,"Audio mute failed")

@router.post("/volume")
def volume_api(b:VolumeBody):
    try:return {"status":"COMPLETED","output_path":set_volume(b.input_path,b.output_path,b.volume)}
    except ValueError as e:raise HTTPException(400,str(e))
    except Exception:raise HTTPException(500,"Audio volume failed")

@router.post("/fade")
def fade_api(b:FadeBody):
    try:return {"status":"COMPLETED","output_path":audio_fade(b.input_path,b.output_path,b.fade_in,b.fade_out,b.duration)}
    except ValueError as e:raise HTTPException(400,str(e))
    except Exception:raise HTTPException(500,"Audio fade failed")

@router.post("/speed")
def speed_api(b:SpeedBody):
    try:return {"status":"COMPLETED","output_path":change_speed(b.input_path,b.output_path,b.speed)}
    except ValueError as e:raise HTTPException(400,str(e))
    except Exception:raise HTTPException(500,"Audio speed failed")

@router.post("/mix")
def mix_api(b:MixBody):
    try:return {"status":"COMPLETED","output_path":mix_tracks(b.input_paths,b.output_path,b.weights)}
    except ValueError as e:raise HTTPException(400,str(e))
    except Exception:raise HTTPException(500,"Audio mix failed")
