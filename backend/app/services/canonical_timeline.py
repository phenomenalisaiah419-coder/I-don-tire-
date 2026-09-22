"""Canonical project timeline state and deterministic operation reducer.

The timeline is the source of truth for edit structure. Rendering consumes a
validated snapshot; the reducer itself never claims media was rendered.
"""
from copy import deepcopy

def _num(v,name):
    try:
        x=float(v)
    except (TypeError,ValueError):
        raise ValueError(f"{name} must be numeric")
    if x < 0: raise ValueError(f"{name} cannot be negative")
    return x

def _clip(state,asset_id):
    for c in state.get("clips",[]):
        if str(c.get("id"))==str(asset_id): return c
    raise ValueError(f"Clip not found: {asset_id}")

def normalize(state):
    if not isinstance(state,dict): raise ValueError("Timeline state must be an object")
    result=deepcopy(state)
    result.setdefault("version",1)
    result.setdefault("tracks",[])
    result.setdefault("clips",[])
    result.setdefault("duration",0.0)
    for c in result["clips"]:
        c["start"]=_num(c.get("start",0),"clip start")
        c["duration"]=_num(c.get("duration",0),"clip duration")
        c["track_id"]=str(c.get("track_id","video"))
        if c["duration"]<=0: raise ValueError("Clip duration must be positive")
    result["clips"].sort(key=lambda c:(float(c.get("start",0)),str(c.get("track_id","video")),str(c.get("id",""))))
    result["duration"]=max([c["start"]+c["duration"] for c in result["clips"]] or [0.0])
    return result

def apply_operation(state,op):
    s=normalize(state); op=dict(op or {}); name=op.get("operation")
    if not name: raise ValueError("Timeline operation is required")
    clips=s["clips"]

    if name in {"trim","cut"}:
        c=_clip(s,op.get("asset_id"))
        start=_num(op.get("start"),"start"); end=_num(op.get("end"),"end")
        if end<=start: raise ValueError("End must be greater than start")
        if start>=c["duration"]: raise ValueError("Start exceeds clip duration")
        end=min(end,c["duration"])
        c["source_start"]=c.get("source_start",0.0)+start
        c["duration"]=end-start

    elif name=="split":
        c=_clip(s,op.get("asset_id")); at=_num(op.get("at"),"at")
        if at<=0 or at>=c["duration"]: raise ValueError("Split point must be inside clip")
        first=deepcopy(c); second=deepcopy(c)
        first["duration"]=at
        second["id"]=f"{c['id']}:split:{at:g}"
        second["start"]=c["start"]+at
        second["duration"]=c["duration"]-at
        second["source_start"]=c.get("source_start",0.0)+at
        clips.remove(c); clips.extend([first,second])

    elif name in {"delete","delete_range"}:
        c=_clip(s,op.get("asset_id")); start=_num(op.get("start"),"start"); end=_num(op.get("end"),"end")
        if end<=start: raise ValueError("End must be greater than start")
        if start>=c["duration"]: raise ValueError("Start exceeds clip duration")
        end=min(end,c["duration"])
        before=deepcopy(c); after=deepcopy(c)
        new=[]
        if start>0:
            before["duration"]=start; new.append(before)
        if end<c["duration"]:
            after["id"]=f"{c['id']}:after:{end:g}"
            after["start"]=c["start"]+start
            after["source_start"]=c.get("source_start",0.0)+end
            after["duration"]=c["duration"]-end; new.append(after)
        clips.remove(c); clips.extend(new)

    elif name=="reorder":
        c=_clip(s,op.get("asset_id"))
        if "to_track" in op: c["track_id"]=str(op["to_track"])
        if "start" in op: c["start"]=_num(op["start"],"start")

    else:
        raise ValueError(f"Unsupported timeline operation: {name}")

    return normalize(s)

def apply_operations(state,operations):
    current=normalize(state)
    for op in operations: current=apply_operation(current,op)
    return current
