# Transform keyframe rendering

Real FFmpeg rendering is now implemented for animated:
- scale
- rotation

Position keyframes are deliberately validated at the operation layer but remain
disabled in this renderer until a proper composition canvas is implemented. This
prevents coordinate animation from being falsely reported as complete.

Each supported transform produces a real output file and verifies the result.
