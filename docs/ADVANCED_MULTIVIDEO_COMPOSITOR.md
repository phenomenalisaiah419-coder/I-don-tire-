# Advanced multi-video compositor

The multi-video compositor now accepts per-clip:
- animated X/Y position
- animated scale
- animated rotation
- animated opacity
- explicit transition metadata

All supported transforms are placed into one FFmpeg filter graph and rendered in a
single encode. Transition metadata is validated but only fade/dissolve are accepted
at this layer; true overlap-aware transition timing remains a separate implementation
step and is not falsely reported as complete.
