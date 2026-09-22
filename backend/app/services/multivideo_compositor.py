"""Controlled FFmpeg multi-video timeline compositor.

Supports multiple video clips placed on a shared canvas with explicit start/end
times and x/y positions. Each clip is trimmed to its timeline interval and
overlaid sequentially. Audio is intentionally handled by the existing audio graph.
"""
from pathlib import Path
import subprocess
from .config import settings

def _run(args, output):
    p=subprocess.run(args,capture_output=True,text=True)
    if p.returncode: raise RuntimeError(p.stderr[-7000:])
    if not Path(output).exists() or Path(output).stat().st_size==0:
        raise RuntimeError("No multi-video output produced")
    return output

def compile_video_graph(nodes:list[dict], width:int=1920, height:int=1080)->str:
    if not nodes: raise ValueError("At least one video node is required")
    if width<=0 or height<=0: raise ValueError("Invalid canvas dimensions")
    parts=[]
    for i,n in enumerate(nodes):
        p=n.get("input")
        if not p or not Path(p).is_file(): raise ValueError("Video input not found")
        start=float(n.get("start",0)); end=n.get("end")
        if start<0 or end is None or float(end)<=start: raise ValueError("Each video node needs a valid start/end")
        x=int(n.get("x",0)); y=int(n.get("y",0))
        parts.append((i,p,start,float(end),x,y))
    filters=[]
    filters.append(f"color=c=black:s={width}x{height}:r=30:d={max(x[3] for x in parts)}[base]")
    current="[base]"
    for i,_,start,end,x,y in parts:
        duration=end-start
        filters.append(f"[{i}:v]trim=duration={duration},setpts=PTS-STARTPTS+{start}/TB[v{i}]")
        filters.append(f"{current}[v{i}]overlay=x={x}:y={y}:eof_action=pass:enable='between(t,{start},{end})'[c{i}]")
        current=f"[c{i}]"
    graph=";".join(filters)
    args += ["-filter_complex",graph,"-map",current,"-an","-c:v","libx264","-pix_fmt","yuv420p"]
    return graph

def render(nodes:list[dict], output_path:str, width:int=1920, height:int=1080)->str:
    graph=compile_video_graph(nodes,width,height)
    args=[settings.ffmpeg_bin,"-y"]
    for n in nodes: args += ["-i",n["input"]]
    args += ["-filter_complex",graph,"-map",f"[c{len(nodes)-1}]","-an",
             "-c:v","libx264","-pix_fmt","yuv420p","-r","30",output_path]
    return _run(args,output_path)
