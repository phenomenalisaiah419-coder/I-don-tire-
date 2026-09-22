# Step 67 — Render Release Configuration

PHENOVA now has one validated runtime configuration contract for render
resource limits and FFmpeg/FFprobe binaries.

It validates:
- concurrent render count
- retry count
- stale-worker timeout
- total input-size budget
- maximum render duration
- video/audio/overlay layer limits
- FFmpeg and FFprobe executable configuration

Deployment configuration remains environment-driven, but unsafe values are
rejected before they silently alter renderer behavior.
