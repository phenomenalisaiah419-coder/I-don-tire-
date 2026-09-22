"""Real FFmpeg-based audio processing primitives for PHENOVA."""
import subprocess
from pathlib import Path
from .config import settings

def _run(args):
    p=subprocess.run(args,capture_output=True,text=True)
    if p.returncode:
        raise RuntimeError(p.stderr[-4000:])
    return p

def normalize(input_path:str, output_path:str, loudness:str="-16"):
    _run([settings.ffmpeg_bin,"-y","-i",input_path,"-af",
          f"loudnorm=I={loudness}:TP=-1.5:LRA=11","-c:a","aac",output_path])
    if not Path(output_path).exists(): raise RuntimeError("No audio output produced")
    return output_path

def denoise(input_path:str, output_path:str):
    _run([settings.ffmpeg_bin,"-y","-i",input_path,"-af","afftdn","-c:a","aac",output_path])
    if not Path(output_path).exists(): raise RuntimeError("No audio output produced")
    return output_path

def mix(inputs:list[str], output_path:str, volumes:list[float]|None=None):
    if not inputs: raise ValueError("At least one audio input is required")
    cmd=[settings.ffmpeg_bin,"-y"]
    for p in inputs: cmd += ["-i",p]
    vols=volumes or [1.0]*len(inputs)
    labels=[]
    for i,v in enumerate(vols):
        labels.append(f"[{i}:a]volume={float(v)}[a{i}]")
    graph=";".join(labels)+f";{''.join(f'[a{i}]' for i in range(len(inputs)))}amix=inputs={len(inputs)}:normalize=0[out]"
    cmd += ["-filter_complex",graph,"-map","[out]","-c:a","aac",output_path]
    _run(cmd)
    if not Path(output_path).exists(): raise RuntimeError("No mixed output produced")
    return output_path

def duck_music(dialogue_path:str, music_path:str, output_path:str):
    # Sidechain compression lowers music while dialogue is present.
    cmd=[settings.ffmpeg_bin,"-y","-i",dialogue_path,"-i",music_path,
         "-filter_complex","[1:a][0:a]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=300[m];[0:a][m]amix=inputs=2:duration=longest[out]",
         "-map","[out]","-c:a","aac",output_path]
    _run(cmd)
    if not Path(output_path).exists(): raise RuntimeError("No ducked output produced")
    return output_path


def mute(input_path:str, output_path:str, start:float=0.0, end:float|None=None):
    if start < 0: raise ValueError("Mute start cannot be negative")
    stop = float(end) if end is not None else 10**9
    af = f"volume=enable='between(t,{float(start)},{stop})':volume=0"
    _run([settings.ffmpeg_bin,"-y","-i",input_path,"-af",af,"-c:v","copy","-c:a","aac",output_path])
    if not Path(output_path).exists(): raise RuntimeError("No muted output produced")
    return output_path

def set_volume(input_path:str, output_path:str, volume:float=1.0):
    if volume < 0: raise ValueError("Volume cannot be negative")
    _run([settings.ffmpeg_bin,"-y","-i",input_path,"-af",f"volume={float(volume)}",
          "-c:v","copy","-c:a","aac",output_path])
    if not Path(output_path).exists(): raise RuntimeError("No volume output produced")
    return output_path

def audio_fade(input_path:str, output_path:str, fade_in:float=0.0, fade_out:float=0.0, duration:float|None=None):
    if fade_in < 0 or fade_out < 0: raise ValueError("Fade durations cannot be negative")
    filters=[]
    if fade_in: filters.append(f"afade=t=in:st=0:d={float(fade_in)}")
    if fade_out:
        if duration is None: raise ValueError("fade_out requires duration")
        filters.append(f"afade=t=out:st={max(0.0,float(duration)-float(fade_out))}:d={float(fade_out)}")
    if not filters: return set_volume(input_path,output_path,1.0)
    _run([settings.ffmpeg_bin,"-y","-i",input_path,"-af",",".join(filters),
          "-c:v","copy","-c:a","aac",output_path])
    if not Path(output_path).exists(): raise RuntimeError("No audio fade output produced")
    return output_path

def change_speed(input_path:str, output_path:str, speed:float=1.0):
    if speed <= 0: raise ValueError("Speed must be positive")
    remaining=float(speed); chain=[]
    # atempo accepts 0.5..2 per filter; chain factors for arbitrary positive speeds.
    while remaining > 2.0:
        chain.append("atempo=2.0"); remaining/=2.0
    while remaining < 0.5:
        chain.append("atempo=0.5"); remaining/=0.5
    chain.append(f"atempo={remaining}")
    _run([settings.ffmpeg_bin,"-y","-i",input_path,"-filter:a",",".join(chain),
          "-c:v","copy","-c:a","aac",output_path])
    if not Path(output_path).exists(): raise RuntimeError("No speed output produced")
    return output_path

def mix_tracks(input_paths:list[str], output_path:str, weights:list[float]|None=None):
    return mix(input_paths,output_path,weights)
