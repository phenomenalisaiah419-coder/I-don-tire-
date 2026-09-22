"""Real FFmpeg visual effects/compositing primitives."""
from pathlib import Path
import subprocess
from .config import settings

def _run(args, output):
    p=subprocess.run(args,capture_output=True,text=True)
    if p.returncode: raise RuntimeError(p.stderr[-4000:])
    if not Path(output).exists() or Path(output).stat().st_size==0:
        raise RuntimeError("No rendered output produced")
    return output

def scale(input_path, output_path, width:int, height:int):
    if width<=0 or height<=0: raise ValueError("Invalid dimensions")
    return _run([settings.ffmpeg_bin,"-y","-i",input_path,"-vf",
                 f"scale={width}:{height}:force_original_aspect_ratio=decrease",
                 "-c:a","copy",output_path],output_path)

def crop(input_path, output_path, width:int, height:int, x:int=0, y:int=0):
    if min(width,height)<1 or min(x,y)<0: raise ValueError("Invalid crop")
    return _run([settings.ffmpeg_bin,"-y","-i",input_path,"-vf",
                 f"crop={width}:{height}:{x}:{y}","-c:a","copy",output_path],output_path)

def rotate(input_path, output_path, degrees:int):
    mapping={90:"transpose=1",180:"hflip,vflip",270:"transpose=2"}
    if degrees not in mapping: raise ValueError("Supported rotations: 90, 180, 270")
    return _run([settings.ffmpeg_bin,"-y","-i",input_path,"-vf",mapping[degrees],
                 "-c:a","copy",output_path],output_path)

def opacity_overlay(base_path, overlay_path, output_path, opacity:float=1.0, x:int=0, y:int=0):
    if not 0<=opacity<=1: raise ValueError("Opacity must be between 0 and 1")
    filt=f"[1:v]format=rgba,colorchannelmixer=aa={opacity}[ov];[0:v][ov]overlay={x}:{y}:shortest=0[out]"
    return _run([settings.ffmpeg_bin,"-y","-i",base_path,"-i",overlay_path,
                 "-filter_complex",filt,"-map","[out]","-map","0:a?","-c:a","copy",output_path],output_path)

def fade(input_path, output_path, fade_in:float=0, fade_out:float=0, duration:float|None=None):
    filters=[]
    if fade_in>0: filters.append(f"fade=t=in:st=0:d={fade_in}")
    if fade_out>0:
        if duration is None: raise ValueError("Duration required for fade-out")
        filters.append(f"fade=t=out:st={max(0,duration-fade_out)}:d={fade_out}")
    if not filters: raise ValueError("At least one fade is required")
    return _run([settings.ffmpeg_bin,"-y","-i",input_path,"-vf",",".join(filters),
                 "-c:a","copy",output_path],output_path)
