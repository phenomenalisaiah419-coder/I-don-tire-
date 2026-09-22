# Live progress render integration

Step 49 connects the real FFmpeg progress controller to the render-job lifecycle.

For the verified live-progress path, a validated Edit Plan is translated into a
single-video project, converted to a concrete FFmpeg command, and executed through
the `-progress pipe:1` controller. Job progress is updated from real FFmpeg telemetry,
and cancellation terminates the active FFmpeg process.

Scope boundary:
- Single-video projects with optional independent audio: live progress/cancel integrated.
- Complex multi-video transition/overlay/subtitle graphs: still use their existing
  renderer path and are not falsely claimed to have live progress yet.


## V13 — Playback-driven transform refresh
- Added controller listener lifecycle management.
- Refreshes animated transforms from playback position.
- Prevents repeated initial-sync scheduling during rebuilds.
