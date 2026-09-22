"""Final PHENOVA release manifest and source integrity audit."""
import hashlib, os, json
from pathlib import Path

EXCLUDE_PARTS={".git","__pycache__",".pytest_cache"}

def build_manifest(root):
    root=Path(root)
    entries=[]
    for p in sorted(root.rglob("*")):
        if not p.is_file() or any(part in EXCLUDE_PARTS for part in p.parts):
            continue
        h=hashlib.sha256()
        with p.open("rb") as f:
            for chunk in iter(lambda:f.read(1024*1024),b""): h.update(chunk)
        entries.append({"path":str(p.relative_to(root)),
                        "bytes":p.stat().st_size,
                        "sha256":h.hexdigest()})
    return {"schema_version":"1.0","file_count":len(entries),"files":entries}

def write_manifest(root,path):
    manifest=build_manifest(root)
    Path(path).write_text(json.dumps(manifest,indent=2,sort_keys=True))
    return manifest
