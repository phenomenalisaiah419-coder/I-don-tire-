"""Attach real rendered media outputs to canonical project versions."""
from pathlib import Path
import hashlib, time

def fingerprint_file(path:str)->dict:
    p=Path(path)
    if not p.exists() or not p.is_file():
        raise FileNotFoundError(path)
    h=hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""):
            h.update(chunk)
    return {"path":str(p),"size_bytes":p.stat().st_size,"sha256":h.hexdigest(),"verified_at":time.time()}

def attach_rendered_asset(version:dict, output_path:str)->dict:
    if version.get("status") not in {"READY_FOR_CANONICAL_EXECUTOR","RENDERED"}:
        raise ValueError("Version is not eligible for rendered asset attachment")
    fp=fingerprint_file(output_path)
    return {**version,"status":"RENDERED","rendered_asset":fp}
