"""Real overlap-aware two-clip transition rendering with synchronized audio."""
from pathlib import Path
import subprocess
from .config import settings

_ALLOWED={"fade":"fade","dissolve":"dissolve"}

def render(first_path, second_path, output_path, transition="dissolve",
           overlap=1.0):
    if transition not in _ALLOWED: raise ValueError("Unsupported transition")
    if overlap<=0: raise ValueError("Overlap must be positive")
    if not Path(first_path).is_file() or not Path(second_path).is_file():
        raise ValueError("Transition input not found")

    # Normalize both streams to start at zero. xfade offset is the end of the first
    # clip minus the requested overlap. acrossfade uses the same duration.
    filt=(
        f"[0:v]settb=AVTB,setpts=PTS-STARTPTS,fps=30,format=yuv420p[v0];"
        f"[1:v]settb=AVTB,setpts=PTS-STARTPTS,fps=30,format=yuv420p[v1];"
        f"[v0][v1]xfade=transition={_ALLOWED[transition]}:"
        f"duration={overlap}:offset=0[v];"
        f"[0:a]asetpts=PTS-STARTPTS[a0];"
        f"[1:a]asetpts=PTS-STARTPTS[a1];"
        f"[a0][a1]acrossfade=d={overlap}:c1=tri:c2=tri[a]"
    )
    args=[settings.ffmpeg_bin,"-y","-i",first_path,"-i",second_path,
          "-filter_complex",filt,"-map","[v]","-map","[a]",
          "-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac",output_path]
    p=subprocess.run(args,capture_output=True,text=True)
    if p.returncode: raise RuntimeError(p.stderr[-7000:])
    if not Path(output_path).exists() or Path(output_path).stat().st_size==0:
        raise RuntimeError("No transition output produced")
    return output_path
