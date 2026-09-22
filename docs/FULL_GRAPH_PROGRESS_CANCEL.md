# Full graph live progress and cancellation

Step 50 routes the integrated project graph through the real FFmpeg progress
controller. The same concrete command used for video/audio/overlay/subtitle
rendering is now available to the job system.

Progress is derived from FFmpeg telemetry and cancellation terminates the active
process. The command builder is kept separate from the executor so the graph can
be tested without running a render.

This covers the integrated project graph. Specialized transition-aware full-frame
rendering remains a separate path until its command builder is unified with this
same executor.
