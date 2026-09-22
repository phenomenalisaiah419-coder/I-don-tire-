"""Render input preflight using ffprobe.

The media graph validates structure; this layer validates that each media input
is actually readable and contains the stream type required by its graph role.
Results are deterministic and bounded so bad uploads fail before FFmpeg starts.
"""
import json, subprocess
from pathlib import Path
from .config import settings

CACHE={}

def probe_media(path:str)->dict:
    p=Path(path)
    if not p.is_file() or p.stat().st_size<=0:
        raise ValueError(f"Media input missing or empty: {path}")
    key=(str(p),p.stat().st_mtime_ns,p.stat().st_size)
    if key in CACHE:return CACHE[key]
    cmd=[settings.ffprobe_bin,"-v","error","-show_entries",
         "format=duration,size,format_name:stream=index,codec_type,codec_name,width,height,"
         "sample_rate,channels,duration",
         "-of","json",str(p)]
    try:r=subprocess.run(cmd,capture_output=True,text=True,timeout=30)
    except FileNotFoundError as e:raise ValueError("ffprobe is not available") from e
    if r.returncode!=0:raise ValueError(f"Unreadable media input: {path}")
    try:data=json.loads(r.stdout)
    except json.JSONDecodeError as e:raise ValueError("Invalid media probe response") from e
    streams=data.get("streams",[])
    fmt=data.get("format",{})
    if not streams:raise ValueError(f"Media has no readable streams: {path}")
    result={"path":str(p),"size":int(fmt.get("size") or p.stat().st_size),
            "duration":float(fmt.get("duration") or 0),
            "format":fmt.get("format_name",""),"streams":streams}
    CACHE[key]=result
    return result

def validate_render_inputs(plan:dict)->dict:
    if not isinstance(plan,dict):raise ValueError("Render Plan must be an object")
    checked=dict(plan)
    for group,required_type in (("videos","video"),("audios","audio"),("overlays","video")):
        rebuilt=[]
        for node in plan.get(group,[]):
            info=probe_media(node["input"])
            if not any(s.get("codec_type")==required_type for s in info["streams"]):
                raise ValueError(f"Input does not contain required {required_type} stream: {node['input']}")
            if float(info["duration"])<=0:
                raise ValueError(f"Input has no valid duration: {node['input']}")
            item=dict(node); item["media_probe"]=info; rebuilt.append(item)
        checked[group]=rebuilt
    for node in plan.get("subtitles",[]):
        p=Path(node["input"])
        if not p.is_file() or p.stat().st_size==0:
            raise ValueError(f"Subtitle input missing or empty: {node['input']}")
    return checked
