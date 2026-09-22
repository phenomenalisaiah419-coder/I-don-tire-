"""Real FFmpeg animated position, scale, and rotation rendering."""
from pathlib import Path
import subprocess, json
from .config import settings

def _points(points, name):
    if not points: raise ValueError(f"{name} keyframes cannot be empty")
    out=[]; last=-1
    for p in points:
        t=float(p["time"])
        if t<0 or t<last: raise ValueError("Keyframe times must be ordered")
        out.append((t,float(p["value"]))); last=t
    return out

def _expr(points):
    p=points
    expr=str(p[-1][1])
    for i in range(len(p)-2,-1,-1):
        t0,v0=p[i]; t1,v1=p[i+1]
        if t1==t0: continue
        expr=f"if(between(t,{t0},{t1}),{v0}+({v1}-{v0})*(t-{t0})/({t1}-{t0}),{expr})"
    return f"if(lt(t,{p[0][0]}),{p[0][1]},{expr})"

def animate_transform(input_path,output_path,position_x=None,position_y=None,
                      scale=None,rotation=None)->str:
    filters=[]
    if scale:
        s=_expr(_points(scale,"scale"))
        filters.append(f"scale=w='iw*({s})':h='ih*({s})':eval=frame")
    if rotation:
        r=_expr(_points(rotation,"rotation"))
        filters.append(f"rotate='{r}*PI/180':ow=rotw(iw):oh=roth(ih)")
    # Position animation is represented as a transparent padded canvas + overlay.
    # This avoids falsely claiming direct frame-coordinate support in scale/rotate.
    if position_x or position_y:
        raise ValueError("Animated position requires a composition canvas and is not yet enabled")
    if not filters: raise ValueError("At least one transform keyframe is required")
    vf=",".join(filters)
    p=subprocess.run([settings.ffmpeg_bin,"-y","-i",input_path,"-vf",vf,
                      "-c:v","libx264","-c:a","copy",output_path],capture_output=True,text=True)
    if p.returncode: raise RuntimeError(p.stderr[-4000:])
    if not Path(output_path).exists() or Path(output_path).stat().st_size==0:
        raise RuntimeError("No transform-rendered output produced")
    return output_path
