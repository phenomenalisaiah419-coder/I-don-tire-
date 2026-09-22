# Transcript ↔ Timeline synchronization v2

Transcript segments carry stable IDs and explicit timing. Changes can be converted into
canonical timeline operations or synchronized timing changes.

Rules:
- The same segment timing is the source of truth for the linked transcript/timeline view.
- Transcript actions never directly mutate media.
- Operations enter the canonical Edit Plan validator/executor.
- Invalid or unsupported operations are rejected.
- Provider-generated transcripts remain subject to real provider evidence.
