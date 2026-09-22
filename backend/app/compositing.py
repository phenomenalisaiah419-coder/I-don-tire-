"""Validated transition, layer, and keyframe primitives."""
def transition(name:str,duration:float)->dict:
    allowed={"fade","dissolve","wipeleft","wiperight"}
    if name not in allowed: raise ValueError("Unsupported transition")
    if duration<=0: raise ValueError("Transition duration must be positive")
    return {"operation":"transition","type":name,"duration":float(duration)}

def layer(asset_id:int,track:int,start:float,end:float,opacity:float=1.0)->dict:
    if asset_id<1 or track<0 or start<0 or end<=start: raise ValueError("Invalid layer")
    if not 0<=opacity<=1: raise ValueError("Invalid opacity")
    return {"operation":"layer","asset_id":asset_id,"track":track,
            "start":float(start),"end":float(end),"opacity":float(opacity)}

def keyframes(property_name:str,points:list[dict])->dict:
    if not points: raise ValueError("Keyframes cannot be empty")
    clean=[]
    last=-1
    for p in points:
        t=float(p["time"])
        if t<0 or t<last: raise ValueError("Keyframe times must be ordered")
        if "value" not in p: raise ValueError("Keyframe value missing")
        clean.append({"time":t,"value":p["value"]}); last=t
    return {"operation":"keyframes","property":property_name,"points":clean}
