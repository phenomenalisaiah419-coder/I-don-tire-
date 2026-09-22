"""Build the verified FFmpeg command used by the project renderer.

This deliberately supports the project's basic single-video + optional audio path
for live progress integration. Complex graph paths remain on the existing renderer
until their command generation is migrated.
"""
from pathlib import Path
from .config import settings

def build_basic_project_command(project, output_path):
    videos=project.get("videos",[])
    audios=project.get("audios",[])
    if len(videos)!=1: raise ValueError("Live-progress path requires exactly one video")
    v=videos[0]
    if not Path(v["input"]).is_file(): raise ValueError("Video input not found")
    args=[settings.ffmpeg_bin,"-y","-i",v["input"]]
    for a in audios:
        if not Path(a["input"]).is_file(): raise ValueError("Audio input not found")
        args += ["-i",a["input"]]
    if audios:
        labels="".join(f"[{i}:a]" for i in range(1,len(audios)+1))
        filt=f"{labels}amix=inputs={len(audios)}:duration=longest:dropout_transition=0[a]"
        args += ["-filter_complex",filt,"-map","0:v","-map","[a]"]
    else:
        args += ["-map","0:v","-map","0:a?"]
    args += ["-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac","-shortest",output_path]
    return args
