# Visual effects and compositing

Real FFmpeg primitives added:
- scale/resize
- crop
- 90/180/270 degree rotation
- opacity overlay
- fade in/out

All primitives require actual input media and verify a non-empty output file.
They are intended to be called through the canonical Edit Plan executor rather than
directly from arbitrary model output.

Advanced transitions, masks, keyframes, tracking, stabilization, chroma key and
complex motion graphics remain additional layers.
