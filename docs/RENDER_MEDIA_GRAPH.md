# Step 61 — Render Media Graph

The Render Plan is now validated as a complete media graph immediately before
renderer selection.

Checks include:
- input-file existence
- video/audio/overlay layer limits
- supported output dimensions
- non-negative and ordered timing
- overlay and audio timing
- basic position sanity
- graph duration calculation

The graph validation happens at the unified renderer boundary, so all render
paths receive the same preflight checks. This reduces malformed FFmpeg graphs,
resource abuse, and inconsistent behavior between sequential and integrated
renderers.
