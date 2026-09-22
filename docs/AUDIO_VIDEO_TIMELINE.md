# Synchronized audio/video timeline

Audio operations are now available to the canonical executor alongside video operations.
A shared timeline representation validates track type and timing, then orders operations
by timeline position.

Supported track types:
- video
- audio
- overlay
- subtitle

This establishes the synchronization model; full multi-track rendering still requires
the executor to combine all simultaneous operations into a single project render plan.
