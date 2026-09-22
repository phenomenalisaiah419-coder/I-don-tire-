"""Validated PHENOVA render release configuration."""
import os
from dataclasses import dataclass

def _int(name,default,minimum,maximum):
    raw=os.getenv(name,str(default))
    try:value=int(raw)
    except ValueError:raise RuntimeError(f"{name} must be an integer")
    if not minimum<=value<=maximum:
        raise RuntimeError(f"{name} outside allowed range")
    return value

@dataclass(frozen=True)
class RenderReleaseConfig:
    max_concurrent:int
    max_retries:int
    stale_seconds:int
    max_input_bytes:int
    max_duration_seconds:int
    max_video_layers:int
    max_audio_layers:int
    max_overlay_layers:int
    ffmpeg_bin:str
    ffprobe_bin:str

def load():
    ffmpeg=os.getenv("PHENOVA_FFMPEG_BIN","ffmpeg").strip()
    ffprobe=os.getenv("PHENOVA_FFPROBE_BIN","ffprobe").strip()
    if not ffmpeg or not ffprobe: raise RuntimeError("FFmpeg/FFprobe configuration is empty")
    return RenderReleaseConfig(
        max_concurrent=_int("PHENOVA_MAX_CONCURRENT_RENDERS",1,1,16),
        max_retries=_int("PHENOVA_MAX_RENDER_RETRIES",2,0,5),
        stale_seconds=_int("PHENOVA_RENDER_STALE_SECONDS",900,60,86400),
        max_input_bytes=_int("PHENOVA_MAX_RENDER_INPUT_BYTES",20*1024**3,1,500*1024**3),
        max_duration_seconds=_int("PHENOVA_MAX_RENDER_DURATION_SECONDS",4*60*60,1,24*60*60),
        max_video_layers=_int("PHENOVA_MAX_RENDER_VIDEO_LAYERS",64,1,128),
        max_audio_layers=_int("PHENOVA_MAX_RENDER_AUDIO_LAYERS",32,1,64),
        max_overlay_layers=_int("PHENOVA_MAX_RENDER_OVERLAYS",64,1,128),
        ffmpeg_bin=ffmpeg,ffprobe_bin=ffprobe)

def validate_runtime():
    cfg=load()
    if cfg.max_concurrent>4 and cfg.max_input_bytes>100*1024**3:
        raise RuntimeError("Render configuration is unsafe for the default resource envelope")
    return cfg
