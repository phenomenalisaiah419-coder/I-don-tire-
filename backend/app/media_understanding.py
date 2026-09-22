"""Evidence-based media understanding primitives.

These functions inspect actual media with ffprobe/FFmpeg. They never claim visual,
speaker, object, or semantic analysis that has not been performed by a configured
provider.
"""
import json, subprocess
from pathlib import Path
from .config import settings

def probe_streams(path: str) -> dict:
    cmd=[settings.ffmpeg_bin.replace("ffmpeg","ffprobe"),"-v","error",
         "-show_streams","-show_format","-of","json",path]
    p=subprocess.run(cmd,capture_output=True,text=True)
    if p.returncode: raise RuntimeError(p.stderr[-4000:])
    return json.loads(p.stdout)

def extract_keyframes(path: str, output_dir: str, fps: float=1.0, max_frames:int=120) -> list[str]:
    Path(output_dir).mkdir(parents=True,exist_ok=True)
    pattern=str(Path(output_dir)/"frame_%05d.jpg")
    cmd=[settings.ffmpeg_bin,"-y","-i",path,"-vf",f"fps={fps}",
         "-frames:v",str(max_frames),"-q:v","3",pattern]
    p=subprocess.run(cmd,capture_output=True,text=True)
    if p.returncode: raise RuntimeError(p.stderr[-4000:])
    return [str(x) for x in sorted(Path(output_dir).glob("frame_*.jpg"))]

def build_evidence_index(path: str, output_dir: str) -> dict:
    metadata=probe_streams(path)
    frames=extract_keyframes(path,output_dir)
    return {"source":path,"metadata":metadata,"keyframes":frames,
            "analysis": {"visual_provider": None, "speech_provider": None}}
