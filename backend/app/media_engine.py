"""Real FFmpeg-backed media engine. No simulated outputs."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any

from .config import settings


def ensure_ffmpeg() -> bool:
    """Return True if a working ffmpeg binary is available."""
    bin_path = settings.ffmpeg_bin or "ffmpeg"
    if shutil.which(bin_path) is None and not Path(bin_path).is_file():
        return False
    try:
        r = subprocess.run(
            [bin_path, "-version"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        return r.returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def _run(cmd: list[str], timeout: int = 600) -> None:
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if result.returncode != 0:
        err = (result.stderr or result.stdout or "")[-4000:]
        raise RuntimeError(f"FFmpeg failed ({result.returncode}): {err}")


def probe(input_path: str) -> dict[str, Any]:
    """Extract real media metadata via ffprobe."""
    if not Path(input_path).is_file():
        raise FileNotFoundError(f"Media not found: {input_path}")
    ffprobe = "ffprobe"
    if settings.ffmpeg_bin and settings.ffmpeg_bin != "ffmpeg":
        candidate = str(Path(settings.ffmpeg_bin).with_name("ffprobe"))
        if shutil.which(candidate) or Path(candidate).is_file():
            ffprobe = candidate
    cmd = [
        ffprobe,
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        input_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {(result.stderr or '')[-2000:]}")
    data = json.loads(result.stdout or "{}")
    duration = float(data.get("format", {}).get("duration") or 0)
    video = None
    audio = None
    for s in data.get("streams", []):
        if s.get("codec_type") == "video" and video is None:
            video = {
                "codec": s.get("codec_name"),
                "width": int(s.get("width") or 0),
                "height": int(s.get("height") or 0),
                "fps": _parse_fps(s.get("r_frame_rate") or s.get("avg_frame_rate")),
            }
        elif s.get("codec_type") == "audio" and audio is None:
            audio = {
                "codec": s.get("codec_name"),
                "sample_rate": int(s.get("sample_rate") or 0),
                "channels": int(s.get("channels") or 0),
            }
    return {
        "duration": duration,
        "size_bytes": int(data.get("format", {}).get("size") or 0),
        "format": data.get("format", {}).get("format_name"),
        "video": video,
        "audio": audio,
        "raw": data,
    }


def _parse_fps(rate: str | None) -> float | None:
    if not rate or rate in ("0/0", "N/A"):
        return None
    try:
        if "/" in rate:
            a, b = rate.split("/", 1)
            return float(a) / float(b) if float(b) else None
        return float(rate)
    except (ValueError, ZeroDivisionError):
        return None


def trim(input_path: str, output_path: str, start: float, end: float) -> str:
    """Trim media to [start, end) using stream copy when possible."""
    if end <= start or start < 0:
        raise ValueError("Invalid trim range")
    duration = end - start
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        settings.ffmpeg_bin,
        "-y",
        "-ss",
        str(start),
        "-i",
        input_path,
        "-t",
        str(duration),
        "-c",
        "copy",
        "-avoid_negative_ts",
        "make_zero",
        output_path,
    ]
    try:
        _run(cmd)
    except RuntimeError:
        cmd = [
            settings.ffmpeg_bin,
            "-y",
            "-ss",
            str(start),
            "-i",
            input_path,
            "-t",
            str(duration),
            "-c:v",
            "libx264",
            "-c:a",
            "aac",
            "-movflags",
            "+faststart",
            output_path,
        ]
        _run(cmd)
    if not Path(output_path).is_file():
        raise RuntimeError("FFmpeg completed without producing an output file")
    return output_path


def mute(input_path: str, output_path: str) -> str:
    """Remove audio track."""
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        settings.ffmpeg_bin,
        "-y",
        "-i",
        input_path,
        "-c:v",
        "copy",
        "-an",
        output_path,
    ]
    _run(cmd)
    if not Path(output_path).is_file():
        raise RuntimeError("Mute produced no output")
    return output_path


def set_volume(input_path: str, output_path: str, level: float) -> str:
    """Adjust audio volume. level=1.0 is original."""
    if level < 0:
        raise ValueError("Volume level must be >= 0")
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        settings.ffmpeg_bin,
        "-y",
        "-i",
        input_path,
        "-filter:a",
        f"volume={level}",
        "-c:v",
        "copy",
        output_path,
    ]
    _run(cmd)
    if not Path(output_path).is_file():
        raise RuntimeError("Volume adjust produced no output")
    return output_path


def change_speed(input_path: str, output_path: str, factor: float) -> str:
    """Change playback speed (video + audio). factor > 0."""
    if factor <= 0:
        raise ValueError("Speed factor must be > 0")
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    atempo_filters = []
    remaining = factor
    while remaining > 2.0:
        atempo_filters.append("atempo=2.0")
        remaining /= 2.0
    while remaining < 0.5:
        atempo_filters.append("atempo=0.5")
        remaining /= 0.5
    atempo_filters.append(f"atempo={remaining}")
    afilter = ",".join(atempo_filters)
    vfilter = f"setpts={1.0 / factor}*PTS"
    cmd = [
        settings.ffmpeg_bin,
        "-y",
        "-i",
        input_path,
        "-filter:v",
        vfilter,
        "-filter:a",
        afilter,
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        output_path,
    ]
    _run(cmd)
    if not Path(output_path).is_file():
        raise RuntimeError("Speed change produced no output")
    return output_path


def concat(input_paths: list[str], output_path: str) -> str:
    """Concatenate clips using the concat demuxer."""
    if len(input_paths) < 2:
        raise ValueError("concat requires at least two inputs")
    for p in input_paths:
        if not Path(p).is_file():
            raise FileNotFoundError(p)
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    list_file = Path(output_path).with_suffix(".concat.txt")
    try:
        with open(list_file, "w", encoding="utf-8") as f:
            for p in input_paths:
                escaped = p.replace("'", "'\\''")
                f.write(f"file '{escaped}'\n")
        cmd = [
            settings.ffmpeg_bin,
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(list_file),
            "-c",
            "copy",
            output_path,
        ]
        try:
            _run(cmd)
        except RuntimeError:
            cmd = [
                settings.ffmpeg_bin,
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(list_file),
                "-c:v",
                "libx264",
                "-c:a",
                "aac",
                "-movflags",
                "+faststart",
                output_path,
            ]
            _run(cmd)
    finally:
        if list_file.exists():
            list_file.unlink(missing_ok=True)
    if not Path(output_path).is_file():
        raise RuntimeError("Concat produced no output")
    return output_path



def crop(input_path: str, output_path: str, width: int, height: int, x: int = 0, y: int = 0) -> str:
    if min(width, height) <= 0 or min(x, y) < 0:
        raise ValueError("Invalid crop parameters")
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    _run([settings.ffmpeg_bin, "-y", "-i", input_path, "-vf", f"crop={width}:{height}:{x}:{y}",
          "-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart", output_path])
    if not Path(output_path).is_file(): raise RuntimeError("Crop produced no output")
    return output_path


def resize(input_path: str, output_path: str, width: int, height: int) -> str:
    if min(width, height) <= 0:
        raise ValueError("Invalid dimensions")
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    _run([settings.ffmpeg_bin, "-y", "-i", input_path, "-vf", f"scale={width}:{height}",
          "-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart", output_path])
    if not Path(output_path).is_file(): raise RuntimeError("Resize produced no output")
    return output_path


def reverse(input_path: str, output_path: str) -> str:
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    _run([settings.ffmpeg_bin, "-y", "-i", input_path, "-vf", "reverse", "-af", "areverse",
          "-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart", output_path], timeout=900)
    if not Path(output_path).is_file(): raise RuntimeError("Reverse produced no output")
    return output_path


def delete_segment(input_path: str, output_path: str, start: float, end: float) -> str:
    if start < 0 or end <= start:
        raise ValueError("Invalid delete range")
    duration = float(probe(input_path).get("duration") or 0)
    if end > duration:
        raise ValueError("Delete range exceeds media duration")
    if start == 0 and end >= duration:
        raise ValueError("Cannot delete the entire media asset")
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    if start == 0:
        return trim(input_path, output_path, end, duration)
    if end >= duration:
        return trim(input_path, output_path, 0, start)
    # Decode/re-encode both retained ranges and concatenate them in one FFmpeg graph.
    filt=(f"[0:v]trim=start=0:end={start},setpts=PTS-STARTPTS[v0];"
          f"[0:a]atrim=start=0:end={start},asetpts=PTS-STARTPTS[a0];"
          f"[0:v]trim=start={end},setpts=PTS-STARTPTS[v1];"
          f"[0:a]atrim=start={end},asetpts=PTS-STARTPTS[a1];"
          "[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]")
    _run([settings.ffmpeg_bin,"-y","-i",input_path,"-filter_complex",filt,"-map","[v]","-map","[a]",
          "-c:v","libx264","-c:a","aac","-movflags","+faststart",output_path], timeout=900)
    if not Path(output_path).is_file(): raise RuntimeError("Delete operation produced no output")
    return output_path

def rotate(input_path: str, output_path: str, degrees: int) -> str:
    mapping={90:"transpose=1", 180:"transpose=1,transpose=1", 270:"transpose=2"}
    if degrees not in mapping: raise ValueError("Rotation must be 90, 180, or 270 degrees")
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    _run([settings.ffmpeg_bin,"-y","-i",input_path,"-vf",mapping[degrees],"-c:v","libx264","-c:a","aac","-movflags","+faststart",output_path])
    if not Path(output_path).is_file(): raise RuntimeError("Rotation produced no output")
    return output_path

def execute_operation(
    operation: str,
    input_path: str,
    output_path: str,
    params: dict[str, Any] | None = None,
) -> str:
    """Dispatch only genuinely implemented operations to FFmpeg."""
    params = params or {}
    op = operation.lower().strip()
    if op in ("trim", "cut", "split"):
        return trim(input_path, output_path, float(params.get("start", 0)), float(params["end"]))
    if op == "mute": return mute(input_path, output_path)
    if op == "volume": return set_volume(input_path, output_path, float(params.get("level", params.get("volume", 1.0))))
    if op == "speed": return change_speed(input_path, output_path, float(params.get("factor", params.get("speed", 1.0))))
    if op == "concat":
        extras=params.get("inputs") or params.get("paths") or []
        return concat([input_path]+list(extras), output_path)
    if op == "crop": return crop(input_path, output_path, int(params["width"]), int(params["height"]), int(params.get("x",0)), int(params.get("y",0)))
    if op in ("resize", "scale"):
        return resize(input_path, output_path, int(params["width"]), int(params["height"]))
    if op == "reverse": return reverse(input_path, output_path)
    if op == "delete": return delete_segment(input_path, output_path, float(params["start"]), float(params["end"]))
    if op == "rotate": return rotate(input_path, output_path, int(params["degrees"]))
    if op == "reorder":
        extras=params.get("inputs") or params.get("paths") or []
        if not extras: raise ValueError("reorder requires an ordered inputs list")
        return concat([input_path]+list(extras), output_path)
    raise ValueError(f"Unsupported or unimplemented operation: {operation}")

