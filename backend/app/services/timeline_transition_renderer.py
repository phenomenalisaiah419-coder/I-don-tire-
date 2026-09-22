"""Render a validated multi-clip fade/dissolve chain.

The renderer builds a sequential FFmpeg graph. Each adjacent pair uses the same
overlap duration for video xfade and audio acrossfade. It deliberately supports
one transition family per adjacent pair and rejects unsupported combinations.
"""
from pathlib import Path
import subprocess
from .config import settings

def render(clips:list[dict], output_path:str)->str:
    if not clips: raise ValueError("At least one clip is required")
    ordered=sorted(clips,key=lambda c:float(c["start"]))
    for c in ordered:
        if not Path(c["input"]).is_file(): raise ValueError("Clip input not found")
        if float(c["end"])<=float(c["start"]): raise ValueError("Invalid clip timing")

    if len(ordered)==1:
        p=subprocess.run([settings.ffmpeg_bin,"-y","-i",ordered[0]["input"],
                          "-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac",output_path],
                         capture_output=True,text=True)
        if p.returncode: raise RuntimeError(p.stderr[-6000:])
    else:
        # Build pairwise intermediates inside one filter graph. Each pair starts
        # at zero; the overlap is applied to xfade/acrossfade. This gives a real
        # timeline-wide chain while keeping timing explicit.
        args=[settings.ffmpeg_bin,"-y"]
        for c in ordered: args += ["-i",c["input"]]
        filters=[]
        for i in range(len(ordered)-1):
            if i==0:
                a_v=f"[0:v]"; a_a=f"[0:a]"
            else:
                a_v=f"[v{i-1}]"; a_a=f"[a{i-1}]"
            b_v=f"[{i+1}:v]"; b_a=f"[{i+1}:a]"
            overlap=float(ordered[i+1].get("overlap",0))
            transition=ordered[i+1].get("transition")
            if transition not in (None,"fade","dissolve"):
                raise ValueError("Unsupported transition")
            if transition:
                if overlap<=0: raise ValueError("Transition overlap must be positive")
                filters.append(
                    f"{a_v}{b_v}xfade=transition={transition}:duration={overlap}:offset=0[v{i}];"
                    f"{a_a}{b_a}acrossfade=d={overlap}:c1=tri:c2=tri[a{i}]")
            else:
                filters.append(
                    f"{a_v}{b_v}concat=n=2:v=1:a=0[v{i}];"
                    f"{a_a}{b_a}concat=n=2:v=0:a=1[a{i}]")
        args += ["-filter_complex",";".join(filters),
                 "-map",f"[v{len(ordered)-2}]","-map",f"[a{len(ordered)-2}]",
                 "-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac",output_path]
        p=subprocess.run(args,capture_output=True,text=True)
        if p.returncode: raise RuntimeError(p.stderr[-7000:])
    if not Path(output_path).exists() or Path(output_path).stat().st_size==0:
        raise RuntimeError("No timeline transition output produced")
    return output_path
