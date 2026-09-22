"""Capability registry — only real, supported operations are exposed."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .media_engine import ensure_ffmpeg


@dataclass
class Capability:
    id: str
    name: str
    category: str
    maturity: str  # implemented | partial | planned
    requires_provider: bool = False
    requires_ffmpeg: bool = False
    requires_librosa: bool = False
    description: str = ""
    platforms: list[str] = field(default_factory=lambda: ["android", "api"])


def _librosa_available() -> bool:
    """Mirrors ensure_ffmpeg()'s pattern: report real availability, never assume it."""
    try:
        import librosa  # noqa: F401
        return True
    except ImportError:
        return False


def _base_capabilities() -> list[Capability]:
    ffmpeg_ok = ensure_ffmpeg()
    librosa_ok = _librosa_available()
    return [
        Capability(
            id="media.probe",
            name="Media Probe",
            category="media",
            maturity="implemented" if ffmpeg_ok else "partial",
            requires_ffmpeg=True,
            description="Real ffprobe metadata extraction (duration, resolution, codecs).",
        ),
        Capability(
            id="edit.trim",
            name="Trim / Cut",
            category="edit",
            maturity="implemented" if ffmpeg_ok else "partial",
            requires_ffmpeg=True,
            description="Real FFmpeg trim with stream copy or re-encode.",
        ),
        Capability(
            id="edit.concat",
            name="Concatenate",
            category="edit",
            maturity="implemented" if ffmpeg_ok else "partial",
            requires_ffmpeg=True,
            description="Concatenate clips via FFmpeg concat demuxer.",
        ),
        Capability(
            id="edit.volume",
            name="Volume",
            category="audio",
            maturity="implemented" if ffmpeg_ok else "partial",
            requires_ffmpeg=True,
            description="Adjust audio volume with FFmpeg.",
        ),
        Capability(
            id="edit.mute",
            name="Mute",
            category="audio",
            maturity="implemented" if ffmpeg_ok else "partial",
            requires_ffmpeg=True,
            description="Remove audio track.",
        ),
        Capability(
            id="edit.speed",
            name="Speed Change",
            category="edit",
            maturity="implemented" if ffmpeg_ok else "partial",
            requires_ffmpeg=True,
            description="Change playback speed (video + audio).",
        ),
        Capability(
            id="edit.plan.validate",
            name="Edit Plan Validation",
            category="core",
            maturity="implemented",
            description="Schema + capability-registry validation of Edit Plans.",
        ),
        Capability(
            id="project.crud",
            name="Project CRUD",
            category="core",
            maturity="implemented",
            description="Create, list, own projects with versioning.",
        ),
        Capability(
            id="auth.jwt",
            name="JWT Authentication",
            category="security",
            maturity="implemented",
            description="Register/login with hashed passwords and JWT tokens.",
        ),
        Capability(
            id="job.render",
            name="Render Jobs",
            category="render",
            maturity="implemented" if ffmpeg_ok else "partial",
            requires_ffmpeg=True,
            description="Queued render jobs with real FFmpeg execution and status.",
        ),
        Capability(
            id="ai.director",
            name="AI Director / Agent",
            category="ai",
            maturity="planned",
            requires_provider=True,
            description="Multi-step natural-language editing agent. Requires authorized AI provider.",
        ),
        Capability(
            id="ai.transcript",
            name="Transcript Editing Surface",
            category="ai",
            maturity="planned",
            requires_provider=True,
            description="Speech-to-text + transcript↔timeline sync. Requires STT provider.",
        ),
        Capability(
            id="media.intelligence",
            name="Unified Media Understanding",
            category="ai",
            maturity="planned",
            requires_provider=True,
            description="Faces, objects, scenes, speech indexing. Requires vision/STT providers.",
        ),
        Capability(
            id="edit.reframe",
            name="Smart Reframing",
            category="edit",
            maturity="planned",
            requires_provider=True,
            description="Subject-aware multi-aspect-ratio reframing.",
        ),
        Capability(
            id="edit.composite",
            name="Compositing / Masks",
            category="creative",
            maturity="planned",
            description="Masks, tracking, background removal. Future capability registry expansion.",
        ),
        Capability(
            id="generative.media",
            name="Generative Editing Interface",
            category="ai",
            maturity="planned",
            requires_provider=True,
            description="Provider-neutral generative media interface (architectural provision only).",
        ),
        Capability(
            id="collab.review",
            name="Collaboration / Review",
            category="collaboration",
            maturity="planned",
            description="Shared projects, comments, approval states (future).",
        ),
        Capability(
            id="ifec.adapter",
            name="IFEC Enhancement Adapter",
            category="architecture",
            maturity="partial",
            description="Optional IFEC provider interface; independent operation when disabled.",
        ),
        Capability(
            id="audio.beat_analysis",
            name="Beat & Silence Analysis",
            category="audio",
            maturity="implemented" if librosa_ok else "planned",
            requires_librosa=True,
            description=(
                "Real librosa-based tempo/beat-grid detection and amplitude-based "
                "silence detection, for beat-aware music placement and silence-based "
                "cutting (spec 4.6). Ported from the DeepSeek submission's approach "
                "and adapted to this codebase's conventions; not present elsewhere "
                "in this build, which otherwise relies on FFmpeg alone for audio."
            ),
        ),
    ]


def list_capabilities() -> list[dict[str, Any]]:
    return [
        {
            "id": c.id,
            "name": c.name,
            "category": c.category,
            "maturity": c.maturity,
            "requires_provider": c.requires_provider,
            "requires_ffmpeg": c.requires_ffmpeg,
            "description": c.description,
            "platforms": c.platforms,
        }
        for c in _base_capabilities()
    ]


def supported_operations() -> set[str]:
    """Operations that can be validated and executed today."""
    ffmpeg_ok = ensure_ffmpeg()
    ops = {"validate"}
    if ffmpeg_ok:
        ops |= {
            "trim", "cut", "split", "concat", "volume", "mute", "speed",
            "crop", "resize", "scale", "reverse", "delete", "reorder", "rotate",
            "fade", "crossfade", "dissolve", "overlay", "audio_fade", "audio_speed",
            "mix_audio", "transform", "subtitle"
        }
    return ops


def is_operation_supported(op: str) -> bool:
    return op in supported_operations()
