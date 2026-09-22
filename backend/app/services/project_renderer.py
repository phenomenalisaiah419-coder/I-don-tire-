"""Controlled end-to-end project renderer.

Combines a primary video timeline, independent audio tracks, subtitle SRT tracks,
and simple overlay images into one FFmpeg graph. Unsupported node types are rejected.
"""
from pathlib import Path
import subprocess
from .config import settings

def _run(args, output):
    p=subprocess.run(args,capture_output=True,text=True)
    if p.returncode: raise RuntimeError(p.stderr[-8000:])
    if not Path(output).exists() or Path(output).stat().st_size==0:
        raise RuntimeError("No project output produced")
    return output

def render(project:dict, output_path:str)->str:
    width=int(project.get("width",1920)); height=int(project.get("height",1080))
    if width<=0 or height<=0: raise ValueError("Invalid project dimensions")
    videos=project.get("videos",[])
    audios=project.get("audios",[])
    subtitles=project.get("subtitles",[])
    overlays=project.get("overlays",[])
    if not videos: raise ValueError("At least one video clip is required")
    for n in videos+audios+overlays:
        if not Path(n["input"]).is_file(): raise ValueError(f"Input not found: {n['input']}")
    for s in subtitles:
        if not Path(s["input"]).is_file(): raise ValueError("Subtitle file not found")

    args=[settings.ffmpeg_bin,"-y"]
    for n in videos+audios+overlays: args += ["-i",n["input"]]

    filters=[]
    duration=max(float(v["end"]) for v in videos)
    filters.append(f"color=c=black:s={width}x{height}:r=30:d={duration}[bg]")
    current="[bg]"
    for i,v in enumerate(videos):
        start=float(v["start"]); end=float(v["end"])
        if end<=start: raise ValueError("Invalid video range")
        x=int(v.get("x",0)); y=int(v.get("y",0))
        filters.append(f"[{i}:v]trim=start=0:duration={end-start},setpts=PTS-STARTPTS+{start}/TB[v{i}]")
        filters.append(f"{current}[v{i}]overlay=x={x}:y={y}:eof_action=pass:enable='between(t,{start},{end})'[cv{i}]")
        current=f"[cv{i}]"

    audio_start= len(videos)
    if audios:
        labels=[]
        for j,a in enumerate(audios):
            idx=audio_start+j
            start=float(a.get("start",0))
            filters.append(f"[{idx}:a]adelay={int(start*1000)}|{int(start*1000)}[a{j}]")
            labels.append(f"[a{j}]")
        filters.append("".join(labels)+f"amix=inputs={len(audios)}:duration=longest:dropout_transition=0[amix]")
        audio_map="[amix]"
    else:
        audio_map=None

    # Overlay images are simple timeline-aware layers.
    overlay_start=len(videos)+len(audios)
    for j,o in enumerate(overlays):
        idx=overlay_start+j
        start=float(o.get("start",0)); end=float(o.get("end",duration))
        x=int(o.get("x",0)); y=int(o.get("y",0))
        filters.append(f"[{idx}:v]format=rgba[ov{j}]")
        filters.append(f"{current}[ov{j}]overlay=x={x}:y={y}:eof_action=pass:enable='between(t,{start},{end})'[co{j}]")
        current=f"[co{j}]"

    # Subtitle files are handled as final video filters. One subtitle track is accepted.
    if subtitles:
        if len(subtitles)>1: raise ValueError("Only one subtitle track is currently supported")
        sub=subtitles[0]["input"].replace("\\","/").replace(":","\\:")
        filters.append(f"{current}subtitles='{sub}'[finalv]")
        current="[finalv]"

    args += ["-filter_complex",";".join(filters),"-map",current]
    if audio_map: args += ["-map",audio_map]
    else: args += ["-map","0:a?"]
    args += ["-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac","-shortest",output_path]
    return _run(args,output_path)
