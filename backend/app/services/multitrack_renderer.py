"""Deterministic FFmpeg multi-track composition renderer."""
from pathlib import Path
import subprocess
from .config import settings

def _run(args, output):
    p=subprocess.run(args,capture_output=True,text=True)
    if p.returncode:
        raise RuntimeError(p.stderr[-6000:])
    if not Path(output).exists() or Path(output).stat().st_size==0:
        raise RuntimeError("No multi-track output produced")
    return output

def render_video_with_audio(video_path:str, audio_paths:list[str], output_path:str,
                            canvas_width:int=1920, canvas_height:int=1080)->str:
    if not Path(video_path).is_file(): raise ValueError("Video input not found")
    if canvas_width<=0 or canvas_height<=0: raise ValueError("Invalid canvas dimensions")
    for p in audio_paths:
        if not Path(p).is_file(): raise ValueError(f"Audio input not found: {p}")

    args=[settings.ffmpeg_bin,"-y","-i",video_path]
    for p in audio_paths: args += ["-i",p]

    if audio_paths:
        labels="".join(f"[{i}:a]" for i in range(1,len(audio_paths)+1))
        filt=f"{labels}amix=inputs={len(audio_paths)}:duration=longest:dropout_transition=0[a]"
        args += ["-filter_complex",filt,"-map","0:v","-map","[a]"]
    else:
        args += ["-map","0:v","-map","0:a?"]

    args += ["-vf",f"scale={canvas_width}:{canvas_height}:force_original_aspect_ratio=decrease,"
             f"pad={canvas_width}:{canvas_height}:(ow-iw)/2:(oh-ih)/2",
             "-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac","-shortest",output_path]
    return _run(args,output_path)
