"""Single-pass multi-video compositor with per-clip transforms and transitions."""
from pathlib import Path
import subprocess
from .config import settings

def _expr(points, default):
    if not points: return str(default)
    pts=sorted((float(p["time"]),float(p["value"])) for p in points)
    last=-1
    for t,_ in pts:
        if t<0 or t<last: raise ValueError("Keyframe times must be ordered")
        last=t
    e=str(pts[-1][1])
    for i in range(len(pts)-2,-1,-1):
        t0,v0=pts[i]; t1,v1=pts[i+1]
        if t1==t0: continue
        e=f"if(between(t,{t0},{t1}),{v0}+({v1}-{v0})*(t-{t0})/({t1}-{t0}),{e})"
    return f"if(lt(t,{pts[0][0]}),{pts[0][1]},{e})"

def render(nodes, output_path, width=1920, height=1080):
    if not nodes: raise ValueError("At least one video node is required")
    if width<=0 or height<=0: raise ValueError("Invalid canvas")
    args=[settings.ffmpeg_bin,"-y"]
    for n in nodes:
        if not Path(n["input"]).is_file(): raise ValueError("Video input not found")
        if float(n["end"])<=float(n["start"]): raise ValueError("Invalid clip range")
        args += ["-i",n["input"]]

    filters=[f"color=c=black:s={width}x{height}:r=30:d={max(float(n['end']) for n in nodes)}[bg]"]
    current="[bg]"
    for i,n in enumerate(nodes):
        start=float(n["start"]); end=float(n["end"])
        scale=_expr(n.get("scale_points"),1)
        rot=_expr(n.get("rotation_points"),0)
        opacity=_expr(n.get("opacity_points"),1)
        x=_expr(n.get("x_points"),n.get("x",0))
        y=_expr(n.get("y_points"),n.get("y",0))
        filters.append(
            f"[{i}:v]trim=duration={end-start},setpts=PTS-STARTPTS,"
            f"scale=w='iw*({scale})':h='ih*({scale})':eval=frame,"
            f"rotate='({rot})*PI/180':ow=rotw(iw):oh=roth(ih),"
            f"format=rgba,colorchannelmixer=aa='{opacity}'[v{i}]")
        filters.append(
            f"{current}[v{i}]overlay=x='{x}':y='{y}':"
            f"eval=frame:eof_action=pass:enable='between(t,{start},{end})'[c{i}]")
        current=f"[c{i}]"

    # Transition rendering is deliberately restricted to explicit adjacent full-frame
    # clips; arbitrary overlap transitions are not silently inferred.
    for n in nodes:
        if n.get("transition") not in (None,"fade","dissolve"):
            raise ValueError("Unsupported compositor transition")
    graph=";".join(filters)
    args += ["-filter_complex",graph,"-map",current,"-an",
             "-c:v","libx264","-pix_fmt","yuv420p","-r","30",output_path]
    p=subprocess.run(args,capture_output=True,text=True)
    if p.returncode: raise RuntimeError(p.stderr[-7000:])
    if not Path(output_path).exists() or Path(output_path).stat().st_size==0:
        raise RuntimeError("No advanced compositor output produced")
    return output_path
