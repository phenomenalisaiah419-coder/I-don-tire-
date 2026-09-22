"""Real FFmpeg animated X/Y positioning on a fixed composition canvas."""
from pathlib import Path
import subprocess
from .config import settings

def _points(points,name):
    if not points: raise ValueError(f"{name} keyframes cannot be empty")
    out=[]; last=-1
    for p in points:
        t=float(p["time"]); v=float(p["value"])
        if t<0 or t<last: raise ValueError("Keyframe times must be ordered")
        out.append((t,v)); last=t
    return out

def _expr(points):
    expr=str(points[-1][1])
    for i in range(len(points)-2,-1,-1):
        t0,v0=points[i]; t1,v1=points[i+1]
        if t1==t0: continue
        expr=f"if(between(t,{t0},{t1}),{v0}+({v1}-{v0})*(t-{t0})/({t1}-{t0}),{expr})"
    return f"if(lt(t,{points[0][0]}),{points[0][1]},{expr})"

def animate_position(input_path,output_path,x_points,y_points,
                     canvas_width:int,canvas_height:int)->str:
    if canvas_width<=0 or canvas_height<=0: raise ValueError("Invalid canvas dimensions")
    xp=_points(x_points,"X"); yp=_points(y_points,"Y")
    x=_expr(xp); y=_expr(yp)
    # Scale/rotate are not applied here; this renderer establishes a fixed canvas and
    # translates the source video to animated coordinates.
    filt=(f"format=rgba,pad={canvas_width}:{canvas_height}:(ow-iw)/2:(oh-ih)/2:"
          f"color=black@0,overlay=x='{x}':y='{y}':eval=frame")
    p=subprocess.run([settings.ffmpeg_bin,"-y","-i",input_path,"-vf",filt,
                      "-c:v","libx264","-pix_fmt","yuv420p","-c:a","copy",output_path],
                     capture_output=True,text=True)
    if p.returncode: raise RuntimeError(p.stderr[-5000:])
    if not Path(output_path).exists() or Path(output_path).stat().st_size==0:
        raise RuntimeError("No position-rendered output produced")
    return output_path
