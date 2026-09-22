from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..creative_intelligence import Segment, pacing_metrics, silence_gaps, repeated_phrases

router=APIRouter()

class CreativeRequest(BaseModel):
    segments:list[dict]
    gap_threshold:float=1.0

@router.post("/analyze")
def analyze(body:CreativeRequest):
    try:
        segs=[Segment(float(x["start"]),float(x["end"]),str(x.get("text",""))) for x in body.segments]
        return {
            "pacing":pacing_metrics(segs),
            "silence_gaps":silence_gaps(segs,body.gap_threshold),
            "repetition":repeated_phrases(segs)
        }
    except (KeyError,TypeError,ValueError) as exc:
        raise HTTPException(400,"Invalid evidence data") from exc
