"""Deterministic media-graph validation and FFmpeg graph planning.

This layer checks the complete Render Plan before FFmpeg is invoked. It validates
inputs, stream roles, timing, overlaps, dimensions and graph size, then produces
a renderer-safe graph specification.
"""
from pathlib import Path
from copy import deepcopy

MAX_VIDEO_LAYERS=64
MAX_AUDIO_LAYERS=32
MAX_OVERLAYS=64

def _input(node,kind):
    p=node.get("input")
    if not p: raise ValueError(f"{kind} node has no input")
    if not Path(p).is_file(): raise ValueError(f"{kind} input not found: {p}")
    return p

def validate_media_graph(plan):
    if not isinstance(plan,dict): raise ValueError("Render Plan must be an object")
    videos=plan.get("videos",[]); audios=plan.get("audios",[])
    overlays=plan.get("overlays",[]); subtitles=plan.get("subtitles",[])
    if not videos: raise ValueError("Media graph has no video layer")
    if len(videos)>MAX_VIDEO_LAYERS: raise ValueError("Too many video layers")
    if len(audios)>MAX_AUDIO_LAYERS: raise ValueError("Too many audio layers")
    if len(overlays)>MAX_OVERLAYS: raise ValueError("Too many overlay layers")
    width=int(plan.get("width",1920)); height=int(plan.get("height",1080))
    if width<16 or height<16 or width>7680 or height>4320:
        raise ValueError("Render dimensions outside supported range")

    duration=0.0
    checked=deepcopy(plan)
    checked.setdefault("videos", [])
    checked.setdefault("audios", [])
    checked.setdefault("overlays", [])
    checked.setdefault("subtitles", [])
    for i,v in enumerate(checked["videos"]):
        if i and v.get("transition") and v.get("transition") not in {"fade","dissolve"}:
            raise ValueError("Unsupported transition")
    for v in checked["videos"]:
        _input(v,"Video")
        start=float(v.get("start",0)); end=float(v.get("end",0))
        if start<0 or end<=start: raise ValueError("Invalid video timing")
        duration=max(duration,end)
        for key in ("x","y"):
            if key in v and abs(float(v[key]))>width*4:
                raise ValueError(f"Video {key} position is unreasonable")
    for a in checked["audios"]:
        _input(a,"Audio")
        start=float(a.get("start",0))
        if start<0: raise ValueError("Audio start cannot be negative")
        if a.get("end") is not None and float(a["end"])<=start:
            raise ValueError("Invalid audio timing")
    for o in checked["overlays"]:
        # Text overlays are generated layers and do not require a media input.
        if o.get("kind", "text") != "text": _input(o,"Overlay")
        start=float(o.get("start",0)); end=float(o.get("end",0))
        if start<0 or end<=start: raise ValueError("Invalid overlay timing")
        if o.get("kind", "text") == "text" and not str(o.get("text", "")).strip():
            raise ValueError("Text overlay cannot be empty")
        duration=max(duration,end)
    for a in checked["audios"]:
        volume=float(a.get("volume",1.0))
        if volume < 0 or volume > 4: raise ValueError("Audio volume outside supported range")
    for s in subtitles:
        _input(s,"Subtitle")

    checked["graph"]={"duration":duration,
                      "video_layers":len(videos),
                      "audio_layers":len(audios),
                      "overlay_layers":len(overlays),
                      "subtitle_layers":len(subtitles)}
    return checked

def graph_summary(plan):
    graph=validate_media_graph(plan)["graph"]
    return graph
