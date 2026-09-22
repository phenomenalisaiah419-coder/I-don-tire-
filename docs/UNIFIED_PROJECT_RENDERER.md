# Unified project renderer

PHENOVA now exposes one project-level render entry point.

Routing rules:
- Sequential full-frame fade/dissolve projects with no extra layers or transforms use
  the verified transition-aware renderer.
- Projects containing independent audio, overlays, subtitles, or per-clip transforms
  use the integrated project renderer.

The unified entry point never silently drops requested features. More advanced
transition-aware rendering inside transformed/overlay-heavy projects remains a
separate capability.
