# Unified transition progress and cancellation

The specialized sequential fade/dissolve renderer now exposes a concrete FFmpeg
command builder and uses the same real progress/cancellation controller as the
integrated project graph.

Render-job routing:
- Pure sequential fade/dissolve project -> transition command builder.
- Projects with audio/overlays/subtitles/transforms -> integrated command builder.
- Both paths -> the same FFmpeg progress and cancellation executor.

No separate or fake progress implementation is maintained.
