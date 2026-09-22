# Real FFmpeg progress and cancellation

Added a real FFmpeg subprocess controller using `-progress pipe:1`. Progress is
derived from FFmpeg's reported duration and output time, and 100% is reported only
after the output file is verified.

Cancellation terminates the active FFmpeg process and escalates to kill if needed.

The existing Edit Plan renderer still needs to route its concrete FFmpeg command
through this controller for every project-render path. Until then, the system must
not claim fine-grained live progress for every render.
