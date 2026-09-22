"""Build the unified project's FFmpeg command for live telemetry.

This step covers the full video/audio/overlay/subtitle graph used by the integrated
project renderer. It returns a concrete command, allowing the existing real FFmpeg
progress controller to monitor the same process.
"""
from pathlib import Path
from .config import settings

def build_project_command(project, output_path):
    videos=project.get("videos",[])
    audios=project.get("audios",[])
    overlays=project.get("overlays",[])
    subtitles=project.get("subtitles",[])
    if not videos: raise ValueError("At least one video clip is required")
    if len(subtitles)>1: raise ValueError("Only one subtitle track is supported")
    for n in videos+audios+overlays+subtitles:
        if not Path(n["input"]).is_file(): raise ValueError(f"Input not found: {n['input']}")

    width=int(project.get("width",1920)); height=int(project.get("height",1080))
    duration=max(float(v["end"]) for v in videos)
    args=[settings.ffmpeg_bin,"-y"]
    for n in videos+audios+overlays: args += ["-i",n["input"]]

    filters=[f"color=c=black:s={width}x{height}:r=30:d={duration}[bg]"]
    current="[bg]"

    for i,v in enumerate(videos):
        start=float(v["start"]); end=float(v["end"])
        if end<=start: raise ValueError("Invalid video range")
        x=int(v.get("x",0)); y=int(v.get("y",0))
        filters.append(f"[{i}:v]trim=duration={end-start},setpts=PTS-STARTPTS+{start}/TB[v{i}]")
        filters.append(f"{current}[v{i}]overlay=x={x}:y={y}:eof_action=pass:"
                       f"enable='between(t,{start},{end})'[cv{i}]")
        current=f"[cv{i}]"

    overlay_start=len(videos)+len(audios)
    for j,o in enumerate(overlays):
        idx=overlay_start+j; start=float(o.get("start",0)); end=float(o.get("end",duration))
        x=int(o.get("x",0)); y=int(o.get("y",0))
        filters.append(f"[{idx}:v]format=rgba[ov{j}]")
        filters.append(f"{current}[ov{j}]overlay=x={x}:y={y}:eof_action=pass:"
                       f"enable='between(t,{start},{end})'[co{j}]")
        current=f"[co{j}]"

    if subtitles:
        sub=subtitles[0]["input"].replace("\\","/").replace(":","\\:")
        filters.append(f"{current}subtitles='{sub}'[finalv]")
        current="[finalv]"

    audio_map=None
    if audios:
        labels=[]
        audio_start=len(videos)
        for j,a in enumerate(audios):
            idx=audio_start+j; delay=int(float(a.get("start",0))*1000)
            filters.append(f"[{idx}:a]adelay={delay}|{delay}[a{j}]")
            labels.append(f"[a{j}]")
        filters.append("".join(labels)+f"amix=inputs={len(audios)}:duration=longest:dropout_transition=0[aout]")
        audio_map="[aout]"

    args += ["-filter_complex",";".join(filters),"-map",current]
    args += ["-map",audio_map] if audio_map else ["-map","0:a?"]
    args += ["-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac","-shortest",output_path]
    return args
