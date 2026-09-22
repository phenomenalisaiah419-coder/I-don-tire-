# Multi-track rendering

A real FFmpeg composition path now combines one video track with multiple audio
tracks in a single render. Audio inputs are mixed with `amix`, video is normalized
to the requested composition canvas, and the result is encoded once.

This is the foundation for full project-level rendering. Timeline start/end offsets,
per-track transforms, overlays and subtitle tracks still need to be translated into
one complete filter graph before the entire editor can render an arbitrary project.
