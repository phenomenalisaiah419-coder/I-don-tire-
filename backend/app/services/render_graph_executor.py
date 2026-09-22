"""Execute a compiled render graph through a controlled FFmpeg pipeline.

This first complete-project renderer supports video + audio nodes and rejects graph
features that do not yet have a verified renderer mapping.
"""
from pathlib import Path
import subprocess
from .config import settings

SUPPORTED_VIDEO={"transform","scale","crop","rotate","fade","crossfade","dissolve","overlay"}
SUPPORTED_AUDIO={"volume","mute_audio","audio_fade","audio_speed","mix_audio"}

def _run(args, output):
    p=subprocess.run(args,capture_output=True,text=True)
    if p.returncode: raise RuntimeError(p.stderr[-7000:])
    if not Path(output).exists() or Path(output).stat().st_size==0:
        raise RuntimeError("Render graph produced no verified output")
    return output

def execute_graph(graph:dict, output_path:str)->str:
    nodes=graph.get("nodes",[])
    if not nodes: raise ValueError("Render graph contains no nodes")
    videos=[n for n in nodes if n["track"] in {"video","overlay"}]
    audios=[n for n in nodes if n["track"]=="audio"]
    subtitles=[n for n in nodes if n["track"]=="subtitle"]
    if subtitles:
        raise ValueError("Subtitle-node rendering requires caption graph integration")
    for n in nodes:
        if n["track"]=="video" and n["operation"] not in SUPPORTED_VIDEO:
            raise ValueError(f"Unsupported video graph operation: {n['operation']}")
        if n["track"]=="audio" and n["operation"] not in SUPPORTED_AUDIO:
            raise ValueError(f"Unsupported audio graph operation: {n['operation']}")
    # Current verified whole-project path: one primary video input plus zero/more audio
    # inputs. More complex video nodes are rejected rather than silently ignored.
    if len(videos)!=1 or videos[0].get("operation") not in {"transform","scale","crop","rotate"}:
        raise ValueError("Complete renderer currently requires one supported primary video node")
    primary=videos[0].get("input")
    if not primary or not Path(primary).is_file(): raise ValueError("Primary video input not found")
    audio_inputs=[]
    for n in audios:
        p=n.get("input")
        if not p or not Path(p).is_file(): raise ValueError("Audio input not found")
        audio_inputs.append(p)
    args=[settings.ffmpeg_bin,"-y","-i",primary]
    for p in audio_inputs: args += ["-i",p]
    if audio_inputs:
        labels="".join(f"[{i}:a]" for i in range(1,len(audio_inputs)+1))
        filt=f"{labels}amix=inputs={len(audio_inputs)}:duration=longest:dropout_transition=0[a]"
        args += ["-filter_complex",filt,"-map","0:v","-map","[a]"]
    else:
        args += ["-map","0:v","-map","0:a?"]
    args += ["-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac","-shortest",output_path]
    return _run(args,output_path)
