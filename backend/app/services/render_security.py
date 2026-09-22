"""Render security and resource-budget gate.

This gate limits media-graph complexity and rejects paths that escape the
configured media root. It is intentionally independent from authentication:
authentication answers who may render; this module answers whether the render
request is safe to execute.
"""
import os
from pathlib import Path
from .config import settings
from .release_config import load as load_release_config

MAX_TOTAL_INPUT_BYTES=int(os.getenv("PHENOVA_MAX_RENDER_INPUT_BYTES",20*1024**3))
MAX_RENDER_DURATION=int(os.getenv("PHENOVA_MAX_RENDER_DURATION_SECONDS",4*60*60))
MAX_VIDEO_LAYERS=int(os.getenv("PHENOVA_MAX_RENDER_VIDEO_LAYERS",64))
MAX_AUDIO_LAYERS=int(os.getenv("PHENOVA_MAX_RENDER_AUDIO_LAYERS",32))
MAX_OVERLAYS=int(os.getenv("PHENOVA_MAX_RENDER_OVERLAYS",64))

def _media_root():
    return Path(settings.media_root).resolve()

def _safe_path(path):
    p=Path(path).resolve()
    root=_media_root()
    try:p.relative_to(root)
    except ValueError: raise ValueError("Render input is outside the PHENOVA media directory")
    return p

def enforce_render_budget(plan):
    if not isinstance(plan,dict): raise ValueError("Render Plan must be an object")
    videos=plan.get("videos",[]); audios=plan.get("audios",[])
    overlays=plan.get("overlays",[])
    cfg=load_release_config()
    if len(videos)>cfg.max_video_layers: raise ValueError("Video layer budget exceeded")
    if len(audios)>cfg.max_audio_layers: raise ValueError("Audio layer budget exceeded")
    if len(overlays)>cfg.max_overlay_layers: raise ValueError("Overlay layer budget exceeded")

    total=0
    duration=float(plan.get("graph",{}).get("duration",0) or 0)
    legacy_duration=globals().get("MAX_RENDER_DURATION",cfg.max_duration_seconds)
    if duration>min(cfg.max_duration_seconds,int(legacy_duration)):
        raise ValueError("Render duration budget exceeded")

    for group in (videos,audios,overlays):
        for node in group:
            p=_safe_path(node.get("input",""))
            if not p.is_file(): raise ValueError(f"Render input not found: {p}")
            total+=p.stat().st_size
    legacy_budget=globals().get("MAX_TOTAL_INPUT_BYTES",cfg.max_input_bytes)
    if total>min(cfg.max_input_bytes,int(legacy_budget)):
        raise ValueError("Total render input size budget exceeded")
    return {"input_bytes":total,"duration":duration,
            "video_layers":len(videos),"audio_layers":len(audios),
            "overlay_layers":len(overlays)}

def validate_render_output_path(path):
    p=Path(path).resolve()
    root=_media_root()
    try:p.relative_to(root)
    except ValueError: raise ValueError("Render output is outside the PHENOVA media directory")
    p.parent.mkdir(parents=True,exist_ok=True)
    return str(p)
