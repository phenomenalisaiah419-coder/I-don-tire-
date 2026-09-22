"""Synchronized audio/video timeline operations."""
def validate_av_operation(op:dict)->dict:
    if not isinstance(op,dict) or not op.get("operation"):
        raise ValueError("Timeline operation requires an operation name")
    start=float(op.get("start",0))
    end=op.get("end")
    if start<0: raise ValueError("Timeline start cannot be negative")
    if end is not None and float(end)<=start: raise ValueError("Timeline end must exceed start")
    track=op.get("track","video")
    if track not in {"video","audio","overlay","subtitle"}:
        raise ValueError("Unsupported timeline track")
    return {**op,"start":start,"end":None if end is None else float(end),"track":track}

def build_av_plan(operations:list[dict])->dict:
    checked=[validate_av_operation(x) for x in operations]
    checked.sort(key=lambda x:(x["start"],x["track"]))
    return {"schema_version":"1.0","operations":checked}
