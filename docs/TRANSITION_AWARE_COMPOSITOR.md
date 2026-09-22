# Transition-aware compositor

Adjacent full-frame clips can now be rendered through one FFmpeg filter graph with
real fade/dissolve `xfade` transitions and synchronized `acrossfade` audio.

The implementation validates transition type, overlap, input existence, and the
absence of gaps in transition chains.

Scope boundary:
- Sequential full-frame transition chains: implemented.
- Arbitrary transformed picture-in-picture overlap transitions: not yet implemented.
- Complex transition families: not yet implemented.
