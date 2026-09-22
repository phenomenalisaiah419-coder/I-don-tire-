from pathlib import Path
import subprocess
from .config import settings

def render_noop(output_path):
    Path(output_path).parent.mkdir(parents=True,exist_ok=True)
    cmd=[settings.ffmpeg_bin,"-y","-f","lavfi","-i","color=c=black:s=16x16:r=1:d=1",
         "-f","lavfi","-i","anullsrc=r=44100:cl=mono","-shortest",
         "-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac",output_path]
    p=subprocess.run(cmd,capture_output=True,text=True)
    if p.returncode or not Path(output_path).is_file():
        raise RuntimeError(p.stderr[-2000:])
    return output_path
