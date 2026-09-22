# Integrated project renderer

The project-level renderer now accepts the major timeline components in one controlled
FFmpeg graph:
- video clips
- per-clip X/Y position, scale, rotation and opacity keyframes
- adjacent fade/dissolve transition metadata with overlap validation
- independent delayed audio tracks
- image overlays with animated position/opacity
- one subtitle track

Unsupported transition families and invalid timeline shapes are rejected. The renderer
still keeps transition validation separate from arbitrary transition inference; full
transition-aware compositing for overlapping transformed clips remains an optimization
target rather than a falsely completed feature.
