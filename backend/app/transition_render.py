"""Real FFmpeg transition and layer rendering primitives."""
from pathlib import Path
import subprocess
from .config import settings

def _run(args, output):
    p=subprocess.run(args,capture_output=True,text=True)
    if p.returncode: raise RuntimeError(p.stderr[-5000:])
    if not Path(output).exists() or Path(output).stat().st_size==0:
        raise RuntimeError("No rendered output produced")
    return output

def crossfade(a:str,b:str,out:str,duration:float=1.0,offset:float=0.0)->str:
    if duration<=0 or offset<0: raise ValueError("Invalid transition timing")
    filt=(f"[0:v]setpts=PTS-STARTPTS,fps=30,settb=AVTB[v0];[1:v]setpts=PTS-STARTPTS,fps=30,settb=AVTB[v1];"
          f"[v0][v1]xfade=transition=fade:duration={duration}:offset={offset}[v];"
          f"[0:a]asetpts=PTS-STARTPTS[a0];[1:a]asetpts=PTS-STARTPTS[a1];"
          f"[a0][a1]acrossfade=d={duration}[a]")
    return _run([settings.ffmpeg_bin,"-y","-i",a,"-i",b,
                 "-filter_complex",filt,"-map","[v]","-map","[a]","-c:v","libx264","-c:a","aac",out],out)

def dissolve(a:str,b:str,out:str,duration:float=1.0,offset:float=0.0)->str:
    if duration<=0 or offset<0: raise ValueError("Invalid transition timing")
    filt=(f"[0:v]setpts=PTS-STARTPTS,fps=30,settb=AVTB[v0];[1:v]setpts=PTS-STARTPTS,fps=30,settb=AVTB[v1];"
          f"[v0][v1]xfade=transition=dissolve:duration={duration}:offset={offset}[v];"
          f"[0:a]asetpts=PTS-STARTPTS[a0];[1:a]asetpts=PTS-STARTPTS[a1];"
          f"[a0][a1]acrossfade=d={duration}[a]")
    return _run([settings.ffmpeg_bin,"-y","-i",a,"-i",b,
                 "-filter_complex",filt,"-map","[v]","-map","[a]","-c:v","libx264","-c:a","aac",out],out)

def overlay_layer(base:str,overlay:str,out:str,x:int=0,y:int=0,opacity:float=1.0)->str:
    if not 0<=opacity<=1: raise ValueError("Opacity must be between 0 and 1")
    filt=f"[1:v]format=rgba,colorchannelmixer=aa={opacity}[ov];[0:v][ov]overlay={x}:{y}:eof_action=pass[v]"
    return _run([settings.ffmpeg_bin,"-y","-i",base,"-i",overlay,
                 "-filter_complex",filt,"-map","[v]","-map","0:a?","-c:v","libx264","-c:a","copy",out],out)
