"""Tests for real FFmpeg media engine — requires ffmpeg on host."""
import os
import subprocess
import tempfile
from pathlib import Path

import pytest
from backend.app.media_engine import (
    ensure_ffmpeg,
    probe,
    trim,
    mute,
    set_volume,
    change_speed,
    execute_operation,
)


@pytest.fixture(scope="module")
def sample_video():
    if not ensure_ffmpeg():
        pytest.skip("ffmpeg not available")
    with tempfile.TemporaryDirectory() as td:
        path = os.path.join(td, "sample.mp4")
        # Generate 3s silent color video
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "color=c=blue:s=320x240:d=3",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
            "-c:v", "libx264", "-c:a", "aac", "-shortest",
            path,
        ]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0 or not os.path.isfile(path):
            pytest.skip(f"Could not generate sample video: {r.stderr[-500:]}")
        yield path


def test_ensure_ffmpeg():
    # Just assert the function runs; value depends on host
    assert isinstance(ensure_ffmpeg(), bool)


def test_probe(sample_video):
    meta = probe(sample_video)
    assert meta["duration"] > 2.5
    assert meta["video"] is not None
    assert meta["video"]["width"] == 320
    assert meta["audio"] is not None


def test_trim(sample_video, tmp_path):
    out = str(tmp_path / "trim.mp4")
    trim(sample_video, out, 0.5, 2.0)
    assert Path(out).is_file()
    meta = probe(out)
    assert 1.0 < meta["duration"] < 2.5


def test_mute(sample_video, tmp_path):
    out = str(tmp_path / "mute.mp4")
    mute(sample_video, out)
    assert Path(out).is_file()
    meta = probe(out)
    assert meta["audio"] is None


def test_volume(sample_video, tmp_path):
    out = str(tmp_path / "vol.mp4")
    set_volume(sample_video, out, 0.5)
    assert Path(out).is_file()


def test_speed(sample_video, tmp_path):
    out = str(tmp_path / "speed.mp4")
    change_speed(sample_video, out, 2.0)
    assert Path(out).is_file()
    meta = probe(out)
    # ~3s original at 2x => ~1.5s
    assert 1.0 < meta["duration"] < 2.5


def test_execute_operation(sample_video, tmp_path):
    out = str(tmp_path / "exec.mp4")
    execute_operation("trim", sample_video, out, {"start": 0, "end": 1})
    assert Path(out).is_file()
