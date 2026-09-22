# PHENOVA Audio Intelligence

Implemented real FFmpeg audio primitives:
- loudness normalization
- noise reduction
- multi-input mixing
- audio ducking primitive

The audio layer is provider-neutral. Speech recognition remains supplied by the configured
Google Speech-to-Text adapter from the prior phase. Higher-level semantic audio decisions
must be made from actual transcript/media analysis; the system must not fabricate analysis.
