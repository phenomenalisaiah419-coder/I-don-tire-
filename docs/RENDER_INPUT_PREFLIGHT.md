# Step 62 — Render Input Preflight

Before any renderer is selected, PHENOVA now probes each media input with
FFprobe.

Checks:
- file exists and is non-empty
- FFprobe can read the container
- the required stream type exists
- media has a valid duration
- subtitle files exist and are non-empty
- probe results are cached for repeated use within the process

This complements Step 61's media-graph validation. Step 61 validates the graph's
structure; Step 62 validates the actual media files entering that graph.
