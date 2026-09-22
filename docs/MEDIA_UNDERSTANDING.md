# Media understanding

PHENOVA now extracts evidence from actual media:
- ffprobe stream/container metadata
- sampled keyframes
- an evidence index that records which analyses are actually available

Visual semantics, face/object recognition, speaker identity, scene semantics, and
similar claims require a configured analysis provider. The code deliberately raises
an unavailable-provider error rather than fabricating those results.
