# Timeline transition renderer

The transition chain is now executable as a multi-clip FFmpeg render. Adjacent clips
with explicit fade/dissolve transitions use `xfade`; audio uses the same overlap
duration through `acrossfade`.

Clips without an explicit transition are concatenated. Unsupported transition types
are rejected. Output existence and non-zero size are verified before completion.

This renderer is the transition-chain layer; the broader project compositor still
needs to combine arbitrary overlays, transforms, subtitles and independent audio
tracks into the same final graph.
