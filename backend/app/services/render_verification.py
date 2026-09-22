"""Post-render verification and atomic publication.

A render is only marked COMPLETED after ffprobe confirms a readable output with
the expected media characteristics. Temporary output is promoted atomically.
"""
import json, os, subprocess
from pathlib import Path
from .config import settings

def probe_output(path:str)->dict:
    p=Path(path)
    if not p.is_file() or p.stat().st_size<=0:
        raise RuntimeError("Render output is missing or empty")
    cmd=[settings.ffprobe_bin,"-v","error","-show_entries",
         "format=duration,size:stream=index,codec_type,codec_name,width,height,duration",
         "-of","json",str(p)]
    try:
        r=subprocess.run(cmd,capture_output=True,text=True,timeout=60)
    except FileNotFoundError as e:
        raise RuntimeError("ffprobe is not available") from e
    if r.returncode!=0:
        raise RuntimeError(f"ffprobe failed: {r.stderr[-1000:]}")
    try:data=json.loads(r.stdout)
    except json.JSONDecodeError as e: raise RuntimeError("Invalid ffprobe output") from e
    streams=data.get("streams",[])
    fmt=data.get("format",{})
    duration=float(fmt.get("duration") or 0)
    if duration<=0: raise RuntimeError("Output has no valid duration")
    if not any(s.get("codec_type")=="video" for s in streams):
        raise RuntimeError("Output contains no video stream")
    return {"duration":duration,"size":int(fmt.get("size") or p.stat().st_size),
            "streams":streams}

def verify_and_publish(temp_path:str,final_path:str,expected_duration:float|None=None)->str:
    info=probe_output(temp_path)
    if expected_duration is not None:
        expected=float(expected_duration)
        # Permit normal encoder/container timing drift but reject materially wrong output.
        if expected>0 and abs(info["duration"]-expected)>max(1.0,expected*0.05):
            raise RuntimeError("Rendered duration differs materially from expected duration")
    final=Path(final_path); final.parent.mkdir(parents=True,exist_ok=True)
    temp=Path(temp_path)
    os.replace(temp,final)
    # Verify the published file as well.
    probe_output(str(final))
    return str(final)
