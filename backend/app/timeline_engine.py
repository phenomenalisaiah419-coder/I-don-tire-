"""Canonical, deterministic timeline operation planning.

Timeline operations never claim to have rendered media. They produce validated
canonical operations that the Edit Plan executor can execute.
"""
def _range(start,end):
    start=float(start); end=float(end)
    if start < 0 or end <= start:
        raise ValueError("Invalid timeline range")
    return start,end

def trim_clip(asset_id:int,start:float,end:float)->dict:
    start,end=_range(start,end)
    return {"operation":"trim","asset_id":asset_id,"start":start,"end":end}

def cut_clip(asset_id:int,start:float,end:float)->dict:
    start,end=_range(start,end)
    return {"operation":"cut","asset_id":asset_id,"start":start,"end":end}

def split_clip(asset_id:int,at:float,duration:float|None=None)->dict:
    at=float(at)
    if at < 0 or (duration is not None and at >= float(duration)):
        raise ValueError("Invalid split point")
    return {"operation":"split","asset_id":asset_id,"at":at}

def delete_range(asset_id:int,start:float,end:float)->dict:
    start,end=_range(start,end)
    return {"operation":"delete_range","asset_id":asset_id,"start":start,"end":end}

def move_clip(asset_id:int,from_track:int,to_track:int,start:float)->dict:
    if from_track<0 or to_track<0 or start<0:
        raise ValueError("Invalid track or start")
    return {"operation":"reorder","asset_id":asset_id,
            "from_track":int(from_track),"to_track":int(to_track),
            "start":float(start)}
