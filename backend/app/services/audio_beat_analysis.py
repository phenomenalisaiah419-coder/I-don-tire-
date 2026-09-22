"""Beat and silence analysis via librosa.

Ported into this build from the independently-submitted DeepSeek codebase,
which was the only one of the three PHENOVA submissions with real audio
beat-detection. Rewritten here to match this codebase's conventions:
relative imports, async-safe (heavy analysis runs in a thread), and —
per the project's "never fake success" rule — every function raises a
clear RuntimeError instead of returning fabricated data when librosa
isn't installed or the input file is missing.

librosa is an optional dependency (see requirements.txt). The rest of
this build's audio handling (backend/app/audio_engine.py) uses FFmpeg
directly and does not need it; this module is additive.
"""
from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any


def _require_librosa():
    try:
        import librosa  # noqa: F401
        import numpy as np  # noqa: F401
    except ImportError as exc:
        raise RuntimeError(
            "librosa (and numpy) are not installed, so beat/silence analysis "
            "is unavailable. Install with: pip install librosa"
        ) from exc
    return librosa, np


def _check_input(input_path: str) -> None:
    if not Path(input_path).is_file():
        raise RuntimeError(f"Input file not found: {input_path}")


async def detect_silence(
    input_path: str,
    threshold_db: float = -40.0,
    min_length_sec: float = 0.5,
) -> list[dict[str, float]]:
    """Real amplitude-based silence detection.

    Returns an empty list if the audio genuinely has no silence at or below
    `threshold_db` for at least `min_length_sec` — this is a real finding,
    not a failure, and must not be reinterpreted as "no result".
    """
    _check_input(input_path)
    librosa, np = _require_librosa()

    def _analyze() -> list[dict[str, float]]:
        y, sr = librosa.load(input_path, sr=None, mono=True)
        db = librosa.amplitude_to_db(np.abs(y) + 1e-10, ref=np.max)
        regions: list[dict[str, float]] = []
        i = 0
        n = len(db)
        while i < n:
            if db[i] < threshold_db:
                start = i / sr
                while i < n and db[i] < threshold_db:
                    i += 1
                end = i / sr
                if end - start >= min_length_sec:
                    regions.append({"start": round(start, 3), "end": round(end, 3)})
            else:
                i += 1
        return regions

    return await asyncio.to_thread(_analyze)


async def detect_beats(input_path: str) -> dict[str, Any]:
    """Real tempo/beat-grid detection via librosa's beat tracker.

    Intended for beat-aware music placement (spec section 4.6) — e.g. so an
    AI-selected music cue or cut point can be snapped to an actual beat
    instead of an arbitrary timestamp.
    """
    _check_input(input_path)
    librosa, np = _require_librosa()

    def _analyze() -> dict[str, Any]:
        y, sr = librosa.load(input_path, sr=None, mono=True)
        tempo, frames = librosa.beat.beat_track(y=y, sr=sr)
        times = librosa.frames_to_time(frames, sr=sr).tolist()
        tempo_val = float(tempo.item()) if hasattr(tempo, "item") else float(tempo)
        return {
            "tempo_bpm": round(tempo_val, 2),
            "beat_times_sec": [round(t, 3) for t in times],
        }

    return await asyncio.to_thread(_analyze)
