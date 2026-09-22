# Full project renderer

PHENOVA now has a controlled end-to-end render path that can combine:
- multiple video timeline clips
- independent audio tracks with timeline delay
- one subtitle track
- simple image overlay layers
- a common composition canvas

All inputs are checked before FFmpeg execution and the output is verified after
rendering. Unsupported project shapes are rejected rather than silently omitted.

Advanced per-node transforms and arbitrary multi-subtitle/motion-graphics composition
still require further integration into this project-level renderer.
