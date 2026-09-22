# Audio engine

Real FFmpeg audio operations:
- mute ranges
- volume adjustment
- fade in/out
- audio speed adjustment
- multi-input audio mixing primitive

Outputs are verified on disk before completion is reported. Audio operations are
intended to be capability-gated and dispatched through the canonical Edit Plan
executor. Pitch-preserving time-stretch remains a separate capability.
