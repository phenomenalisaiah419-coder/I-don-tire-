"""Transition-aware sequential compositor.

Builds a real FFmpeg chain for adjacent full-frame clips. Each transition uses
the requested overlap for both video xfade and audio acrossfade. Clips without
a transition are concatenated. This is intentionally limited to sequential
full-frame clips; transformed picture-in-picture overlaps remain separate.
"""
from pathlib import Path
import subprocess
from .config import settings

SUPPORTED={"fade","dissolve"}

def _run(args, output):
    p=subprocess.run(args,capture_output=True,text=True)
    if p.returncode: raise RuntimeError(p.stderr[-8000:])
    if not Path(output).exists() or Path(output).stat().st_size==0:
        raise RuntimeError("No transition-aware output produced")
    return output

def render(clips:list[dict], output_path:str)->str:
    if not clips: raise ValueError("At least one clip is required")
    clips=sorted(clips,key=lambda x:float(x.get("start",0)))
    for i,c in enumerate(clips):
        if i and c.get("transition") and c.get("transition") not in SUPPORTED:
            raise ValueError("Unsupported transition")
        if float(c["end"])<=float(c["start"]): raise ValueError("Invalid clip timing")
    for c in clips:
        if not Path(c["input"]).is_file(): raise ValueError("Clip input not found")
    if len(clips)==1:
        return _run([settings.ffmpeg_bin,"-y","-i",clips[0]["input"],
                     "-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac",output_path],output_path)

    args=[settings.ffmpeg_bin,"-y"]
    for c in clips: args += ["-i",c["input"]]
    filters=[]
    prev_v="[v0]"; prev_a="[a0]"
    filters.append("[0:v]setpts=PTS-STARTPTS,fps=30,settb=AVTB[v0]")
    filters.append("[0:a]asetpts=PTS-STARTPTS[a0]")
    for i in range(1,len(clips)):
        c=clips[i]
        transition=c.get("transition")
        overlap=float(c.get("overlap",0))
        if transition:
            if transition not in SUPPORTED: raise ValueError("Unsupported transition")
            if overlap<=0: raise ValueError("Transition overlap must be positive")
            prev_v_label=f"v{i-1}"
            prev_a_label=f"a{i-1}"
            # xfade offset is based on the accumulated rendered duration. The
            # plan provides explicit clip timing; enforce no gaps for this mode.
            previous=clips[i-1]
            if float(c["start"]) > float(previous["end"]):
                raise ValueError("Sequential transition chain cannot contain gaps")
            duration=float(previous["end"])-float(previous["start"])
            offset=max(0,duration-overlap) if i==1 else max(0,float(c["start"])-overlap)
            filters.append(
                f"[{i}:v]setpts=PTS-STARTPTS,fps=30,settb=AVTB[v{i}in];"
                f"{prev_v}[v{i}in]xfade=transition={transition}:duration={overlap}:offset={offset}[v{i}]")
            filters.append(
                f"{prev_a}[{i}:a]asetpts=PTS-STARTPTS[a{i}in];"
                f"[{prev_a_label}][a{i}in]acrossfade=d={overlap}:c1=tri:c2=tri[a{i}]")
            prev_v=f"[v{i}]"; prev_a=f"[a{i}]"
        else:
            filters.append(f"{prev_v}[{i}:v]concat=n=2:v=1:a=0[v{i}]")
            filters.append(f"{prev_a}[{i}:a]concat=n=2:v=0:a=1[a{i}]")
            prev_v=f"[v{i}]"; prev_a=f"[a{i}]"
    args += ["-filter_complex",";".join(filters),"-map",prev_v,"-map",prev_a,
             "-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac","-shortest",output_path]
    return _run(args,output_path)
