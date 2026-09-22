# Transcript ↔ Timeline Synchronization

Transcript and timeline are two views over canonical project state.

Rules:
- Transcript segments must come from real transcription or explicit user input.
- Segment IDs and timestamps remain stable identifiers for corrections.
- Transcript edits become canonical operations and are versioned through the Edit Plan system.
- Unsupported media operations are rejected, never simulated.
- Google Speech-to-Text is a real provider adapter; credentials are never embedded in source.
