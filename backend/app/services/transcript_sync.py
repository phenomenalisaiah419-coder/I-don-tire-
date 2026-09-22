"""Transcript ↔ timeline synchronization primitives.

Transcript edits are represented as explicit canonical operations. The service does not
invent media timing or mutate media directly.
"""
def validate_segment(segment:dict)->None:
    if "id" not in segment or "start" not in segment or "end" not in segment:
        raise ValueError("Transcript segment requires id, start and end")
    if float(segment["start"])<0 or float(segment["end"])<=float(segment["start"]):
        raise ValueError("Invalid transcript segment timing")

def segment_to_operation(segment:dict, action:str="remove")->dict:
    validate_segment(segment)
    if action=="remove":
        return {"operation":"delete_range","asset_id":segment.get("asset_id"),
                "start":float(segment["start"]),"end":float(segment["end"]),
                "source":"transcript","segment_id":segment["id"]}
    if action=="mute":
        return {"operation":"mute","asset_id":segment.get("asset_id"),
                "start":float(segment["start"]),"end":float(segment["end"]),
                "source":"transcript","segment_id":segment["id"]}
    raise ValueError("Unsupported transcript action")

def sync_change(segment:dict, new_start:float|None=None, new_end:float|None=None)->dict:
    validate_segment(segment)
    start=float(segment["start"] if new_start is None else new_start)
    end=float(segment["end"] if new_end is None else new_end)
    if start<0 or end<=start: raise ValueError("Invalid synchronized range")
    return {"segment_id":segment["id"],"start":start,"end":end,
            "timeline":{"asset_id":segment.get("asset_id"),"start":start,"end":end}}
