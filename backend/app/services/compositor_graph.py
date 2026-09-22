"""Builds a deterministic FFmpeg filter graph for overlays, transitions, and audio controls.

This module only plans filters; the render worker owns process execution.
"""
from __future__ import annotations


def _esc(value: str) -> str:
    return str(value).replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")


def build_compositor_filters(plan: dict) -> dict:
    """Return filter fragments and output labels for a validated render plan."""
    filters: list[str] = []
    video = "[0:v]"
    audio = "[0:a]"
    for i, overlay in enumerate(plan.get("overlays", [])):
        text = _esc(overlay.get("text", ""))
        x = overlay.get("x", 40); y = overlay.get("y", 40)
        fontsize = int(overlay.get("fontSize", 48))
        start = float(overlay.get("start", 0)); end = float(overlay.get("end", 10**6))
        out = f"[ov{i}]"
        filters.append(f"{video}drawtext=text='{text}':x={x}:y={y}:fontsize={fontsize}:enable='between(t,{start},{end})'{out}")
        video = out
    for i, item in enumerate(plan.get("audios", [])):
        volume = float(item.get("volume", 1.0))
        if volume < 0 or volume > 4: raise ValueError("Audio volume must be between 0 and 4")
        start = max(0.0, float(item.get("start", 0)))
        chain = f"volume={volume}"
        if item.get("fadeIn") is not None: chain += f",afade=t=in:st={start}:d={float(item['fadeIn'])}"
        if item.get("fadeOut") is not None: chain += f",afade=t=out:st={float(item.get('fadeOutStart', 0))}:d={float(item['fadeOut'])}"
        out = f"[au{i}]"
        filters.append(f"{audio}{chain}{out}")
        audio = out
    return {"filters": filters, "video_label": video, "audio_label": audio}
