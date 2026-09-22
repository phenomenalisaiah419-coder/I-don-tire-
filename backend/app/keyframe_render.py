from pathlib import Path
import subprocess
from .config import settings

def _validate(points):
    if not points: raise ValueError("Keyframe list cannot be empty")
    last=-1.0
    for p in points:
        t=float(p["time"]); v=float(p["value"])
        if t<0 or t<last: raise ValueError("Keyframe times must be ordered")
        if not 0<=v<=1: raise ValueError("Opacity must be between 0 and 1")
        last=t

def interpolate(points,t):
    _validate(points)
    pts=[(float(x["time"]),float(x["value"])) for x in points]
    if t<=pts[0][0]: return pts[0][1]
    if t>=pts[-1][0]: return pts[-1][1]
    for (a,av),(b,bv) in zip(pts,pts[1:]):
        if a<=t<=b: return av+(bv-av)*(t-a)/(b-a)
    return pts[-1][1]

def animate_opacity(input_path,output_path,points):
    _validate(points)
    pts=sorted((float(p["time"]),float(p["value"])) for p in points)
    expr=str(pts[-1][1])
    for i in range(len(pts)-2,-1,-1):
        t0,v0=pts[i]; t1,v1=pts[i+1]
        expr=f"if(between(t,{t0},{t1}),{v0}+({v1}-{v0})*(t-{t0})/({t1}-{t0}),{expr})"
    expr=f"if(lt(t,{pts[0][0]}),{pts[0][1]},{expr})"
    filt=f"format=rgba,colorchannelmixer=aa='{expr}'"
    p=subprocess.run([settings.ffmpeg_bin,"-y","-i",input_path,"-vf",filt,"-c:v","libx264","-c:a","copy",output_path],capture_output=True,text=True)
    if p.returncode: raise RuntimeError(p.stderr[-4000:])
    if not Path(output_path).exists() or Path(output_path).stat().st_size==0: raise RuntimeError("No rendered output")
    return output_path
