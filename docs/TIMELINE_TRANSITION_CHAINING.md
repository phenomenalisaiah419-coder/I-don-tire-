# Timeline transition chaining

The timeline now compiles multiple adjacent clips into a deterministic transition
chain. Each explicit fade/dissolve transition carries an overlap duration and a
video/audio synchronization flag.

The compiler validates:
- chronological clip ranges
- supported transition types
- positive, bounded overlap
- touching/overlapping clips

This step establishes the timeline-wide transition plan. A later renderer can consume
this chain to build one complete multi-clip FFmpeg graph.
