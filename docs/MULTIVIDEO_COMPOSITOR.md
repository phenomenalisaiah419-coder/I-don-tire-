# Multi-video compositor

The render layer now supports multiple video nodes on a shared canvas. Each node has
an explicit source, timeline start/end, and x/y placement. FFmpeg trims each source,
sets timeline timestamps, then overlays nodes in deterministic order.

Audio remains separated from this compositor and is handled by the existing audio
render graph. This prevents accidental audio duplication while visual composition
is being built out.

Transitions between clips and more advanced per-node transforms remain separate
capabilities.
