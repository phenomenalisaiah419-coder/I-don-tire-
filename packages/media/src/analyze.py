"""
Phenova Media Intelligence

Shot boundary, face tracking (MediaPipe), audio analysis,
quality scoring. Degrades gracefully when optional deps are missing.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
import json
import sys
import os
import uuid

try:
    import cv2
    HAS_CV = True
except ImportError:
    HAS_CV = False

try:
    import mediapipe as mp
    HAS_MP = True
except ImportError:
    HAS_MP = False

try:
    import librosa
    import numpy as np
    HAS_AUDIO = True
except ImportError:
    HAS_AUDIO = False
    np = None  # type: ignore


@dataclass
class SceneBoundary:
    start_ms: float
    end_ms: float
    confidence: float


@dataclass
class FaceTrack:
    track_id: str
    frames: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class ObjectTrack:
    track_id: str
    label: str
    frames: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class AudioAnalysis:
    beats: List[float] = field(default_factory=list)
    energy: List[Dict[str, float]] = field(default_factory=list)
    silence: List[Dict[str, float]] = field(default_factory=list)


@dataclass
class MediaAnalysisResult:
    scenes: List[SceneBoundary] = field(default_factory=list)
    faces: List[FaceTrack] = field(default_factory=list)
    objects: List[ObjectTrack] = field(default_factory=list)
    audio: Optional[AudioAnalysis] = None
    quality_score: Optional[float] = None
    embedding: Optional[List[float]] = None
    duration_ms: Optional[float] = None
    width: Optional[int] = None
    height: Optional[int] = None
    fps: Optional[float] = None

    def to_dict(self) -> dict:
        d: Dict[str, Any] = {
            "scenes": [
                {"startMs": s.start_ms, "endMs": s.end_ms, "confidence": s.confidence}
                for s in self.scenes
            ],
            "faces": [
                {"trackId": f.track_id, "frames": f.frames} for f in self.faces
            ],
            "objects": [
                {"trackId": o.track_id, "label": o.label, "frames": o.frames}
                for o in self.objects
            ],
            "audio": None,
            "qualityScore": self.quality_score,
            "embedding": self.embedding,
            "durationMs": self.duration_ms,
            "width": self.width,
            "height": self.height,
            "fps": self.fps,
        }
        if self.audio:
            d["audio"] = {
                "beats": self.audio.beats,
                "energy": self.audio.energy,
                "silence": self.audio.silence,
            }
        return d


def _probe_video(path: str):
    if not HAS_CV:
        return None, None, None, None
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        return None, None, None, None
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frames = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    duration_ms = (frames / fps) * 1000 if fps > 0 else None
    cap.release()
    return duration_ms, w or None, h or None, fps


def _detect_scenes_opencv(path: str, threshold: float = 27.0) -> List[SceneBoundary]:
    if not HAS_CV:
        return []
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        return []

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    scenes: List[SceneBoundary] = []
    prev_hist = None
    start_ms = 0.0
    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        hist = cv2.calcHist([gray], [0], None, [64], [0, 256])
        hist = cv2.normalize(hist, hist).flatten()

        if prev_hist is not None:
            diff = cv2.compareHist(prev_hist, hist, cv2.HISTCMP_CHISQR)
            if diff > threshold:
                end_ms = (frame_idx / fps) * 1000
                if end_ms - start_ms > 300:
                    scenes.append(SceneBoundary(start_ms, end_ms, min(1.0, diff / 100)))
                    start_ms = end_ms
        prev_hist = hist
        frame_idx += 1

    end_ms = (frame_idx / fps) * 1000
    if end_ms > start_ms:
        scenes.append(SceneBoundary(start_ms, end_ms, 0.9))
    cap.release()
    return scenes


def _track_faces_mediapipe(
    path: str,
    sample_every_n: int = 5,
    max_frames: int = 300,
) -> List[FaceTrack]:
    """Sample frames, run MediaPipe Face Detection, associate tracks by IoU."""
    if not HAS_CV or not HAS_MP:
        return []

    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        return []

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    mp_face = mp.solutions.face_detection

    tracks: List[FaceTrack] = []
    active: List[tuple] = []

    def iou(a: Dict, b: Dict) -> float:
        ax2, ay2 = a["x"] + a["w"], a["y"] + a["h"]
        bx2, by2 = b["x"] + b["w"], b["y"] + b["h"]
        ix1, iy1 = max(a["x"], b["x"]), max(a["y"], b["y"])
        ix2, iy2 = min(ax2, bx2), min(ay2, by2)
        iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
        inter = iw * ih
        if inter <= 0:
            return 0.0
        union = a["w"] * a["h"] + b["w"] * b["h"] - inter
        return inter / union if union > 0 else 0.0

    frame_idx = 0
    sampled = 0

    with mp_face.FaceDetection(model_selection=0, min_detection_confidence=0.5) as detector:
        while sampled < max_frames:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % sample_every_n != 0:
                frame_idx += 1
                continue

            time_ms = (frame_idx / fps) * 1000
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = detector.process(rgb)

            detections = []
            if results.detections:
                for det in results.detections:
                    bb = det.location_data.relative_bounding_box
                    box = {
                        "x": float(bb.xmin),
                        "y": float(bb.ymin),
                        "w": float(bb.width),
                        "h": float(bb.height),
                    }
                    conf = float(det.score[0]) if det.score else 0.5
                    detections.append((box, conf))

            used_tracks = set()
            used_dets = set()
            pairs = []
            for ti, (tidx, last_box) in enumerate(active):
                for di, (box, conf) in enumerate(detections):
                    score = iou(last_box, box)
                    if score > 0.3:
                        pairs.append((score, ti, di))
            pairs.sort(reverse=True)

            for score, ti, di in pairs:
                if ti in used_tracks or di in used_dets:
                    continue
                used_tracks.add(ti)
                used_dets.add(di)
                tidx, _ = active[ti]
                box, conf = detections[di]
                tracks[tidx].frames.append({
                    "timeMs": time_ms,
                    "box": box,
                    "confidence": conf,
                })
                active[ti] = (tidx, box)

            for di, (box, conf) in enumerate(detections):
                if di in used_dets:
                    continue
                tid = str(uuid.uuid4())[:8]
                tracks.append(FaceTrack(
                    track_id=tid,
                    frames=[{"timeMs": time_ms, "box": box, "confidence": conf}],
                ))
                active.append((len(tracks) - 1, box))

            active = [(i, t.frames[-1]["box"]) for i, t in enumerate(tracks) if t.frames]

            frame_idx += 1
            sampled += 1

    cap.release()
    return tracks


def _analyze_audio(path: str) -> Optional[AudioAnalysis]:
    if not HAS_AUDIO:
        return None
    try:
        y, sr = librosa.load(path, sr=None, mono=True, duration=120)
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
        beat_times = librosa.frames_to_time(beat_frames, sr=sr)
        beats_ms = [float(t * 1000) for t in beat_times]

        hop = 512
        rms = librosa.feature.rms(y=y, hop_length=hop)[0]
        times = librosa.frames_to_time(range(len(rms)), sr=sr, hop_length=hop)
        energy = [{"timeMs": float(t * 1000), "value": float(v)} for t, v in zip(times, rms)]

        silence = []
        thresh = float(np.median(rms) * 0.3)
        in_silence = False
        sil_start = 0.0
        for t, v in zip(times, rms):
            if v < thresh and not in_silence:
                in_silence = True
                sil_start = float(t * 1000)
            elif v >= thresh and in_silence:
                in_silence = False
                silence.append({"startMs": sil_start, "endMs": float(t * 1000)})

        return AudioAnalysis(beats=beats_ms, energy=energy, silence=silence)
    except Exception:
        return None


def _quality_heuristic(width, height, fps) -> float:
    score = 0.5
    if width and height:
        pixels = width * height
        if pixels >= 1920 * 1080:
            score += 0.25
        elif pixels >= 1280 * 720:
            score += 0.15
    if fps and fps >= 24:
        score += 0.1
    return min(1.0, score)



def _track_objects_opencv(
    path: str,
    sample_every_n: int = 10,
    max_frames: int = 200,
) -> List[ObjectTrack]:
    """
    Lightweight object presence via OpenCV HOG person detector +
    motion blobs. Not a full multi-class tracker; good enough for
    "is there a person / moving object" signals for AI editing.
    """
    if not HAS_CV:
        return []

    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        return []

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    hog = cv2.HOGDescriptor()
    hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())

    tracks: List[ObjectTrack] = []
    frame_idx = 0
    sampled = 0
    person_track = ObjectTrack(track_id="person-hog", label="person", frames=[])

    while sampled < max_frames:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % sample_every_n != 0:
            frame_idx += 1
            continue

        time_ms = (frame_idx / fps) * 1000
        h, w = frame.shape[:2]
        # Downscale for speed
        scale = 400 / max(w, 1)
        small = cv2.resize(frame, (int(w * scale), int(h * scale)))
        boxes, weights = hog.detectMultiScale(small, winStride=(8, 8), padding=(4, 4), scale=1.05)

        for (x, y, bw, bh), weight in zip(boxes, weights):
            box = {
                "x": float(x / small.shape[1]),
                "y": float(y / small.shape[0]),
                "w": float(bw / small.shape[1]),
                "h": float(bh / small.shape[0]),
            }
            person_track.frames.append({
                "timeMs": time_ms,
                "box": box,
                "confidence": float(min(1.0, weight / 2.0)) if weight else 0.5,
            })

        frame_idx += 1
        sampled += 1

    cap.release()
    if person_track.frames:
        tracks.append(person_track)
    return tracks


def analyze_media(path: str) -> MediaAnalysisResult:
    result = MediaAnalysisResult()

    if not os.path.exists(path):
        return result

    duration_ms, width, height, fps = _probe_video(path)
    result.duration_ms = duration_ms
    result.width = width
    result.height = height
    result.fps = fps

    result.scenes = _detect_scenes_opencv(path)
    if not result.scenes and duration_ms:
        result.scenes = [SceneBoundary(0, duration_ms, 0.5)]

    result.faces = _track_faces_mediapipe(path)
    result.objects = _track_objects_opencv(path)
    result.audio = _analyze_audio(path)
    result.quality_score = _quality_heuristic(width, height, fps)

    return result


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python analyze.py <media_path>")
        print(f"OpenCV={HAS_CV} MediaPipe={HAS_MP} Audio={HAS_AUDIO}")
        sys.exit(1)
    result = analyze_media(sys.argv[1])
    print(json.dumps(result.to_dict(), indent=2))
