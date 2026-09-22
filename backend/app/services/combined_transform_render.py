"""Single-pass FFmpeg transform compositor.

Combines animated scale, rotation, X/Y position and opacity into one filter graph,
avoiding multiple intermediate encodes.
"""
from pathlib import Path
import subprocess
from .config import settings

def _expr(points, name, default):
    if not points: return str(default)
    pts=[(float(p["time"]),float(p["value"])) for p in points]
    last=-1
    for t,_ in pts:
        if t<0 or t<last: raise ValueError(f"{name} keyframe times must be ordered")
        last=t
    expr=str(pts[-1][1])
    for i in range(len(pts)-2,-1,-1):
        t0,v0=pts[i]; t1,v1=pts[i+1]
        if t1==t0: continue
        expr=f"if(between(t,{t0},{t1}),{v0}+({v1}-{v0})*(t-{t0})/({t1}-{t0}),{expr})"
    return f"if(lt(t,{pts[0][0]}),{pts[0][1]},{expr})"

def render(input_path, output_path, canvas_width=1920, canvas_height=1080,
           x_points=None,y_points=None,scale_points=None,rotation_points=None,
           opacity_points=None):
    if canvas_width<=0 or canvas_height<=0: raise ValueError("Invalid canvas dimensions")
    x=_expr(x_points,"x",0); y=_expr(y_points,"y",0)
    scale=_expr(scale_points,"scale",1); rot=_expr(rotation_points,"rotation",0)
    opacity=_expr(opacity_points,"opacity",1)
    # One filter graph: scale -> rotate -> alpha -> pad -> animated overlay.
    # The canvas is transparent-capable during composition, then encoded to yuv420p.
    filt=(
        f"[0:v]scale=w='iw*({scale})':h='ih*({scale})':eval=frame,"
        f"rotate='({rot})*PI/180':ow=rotw(iw):oh=roth(ih),"
        f"format=rgba,colorchannelmixer=aa='{opacity}'[fg];"
        f"color=c=black@0.0:s={canvas_width}x{canvas_height}:r=30[bg];"
        f"[bg][fg]overlay=x='{x}':y='{y}':eval=frame:shortest=1[v]"
    )
    args=[settings.ffmpeg_bin,"-y","-i",input_path,"-filter_complex",filt,
          "-map","[v]","-map","0:a?","-c:v","libx264","-pix_fmt","yuv420p",
          "-c:a","aac","-shortest",output_path]
    p=subprocess.run(args,capture_output=True,text=True)
    if p.returncode: raise RuntimeError(p.stderr[-5000:])
    if not Path(output_path).exists() or Path(output_path).stat().st_size==0:
        raise RuntimeError("No combined-transform output produced")
    return output_path
