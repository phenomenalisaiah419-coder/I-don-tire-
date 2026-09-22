# Step 58 — Render Concurrency, Cleanup + Recovery

The persistent render system now has production-oriented lifecycle controls.

Implemented:
- configurable maximum concurrent render count
- atomic queue claiming respects the concurrency ceiling
- worker heartbeats
- stale-worker detection based on heartbeat/updated timestamps
- bounded automatic recovery attempts
- terminal failure after retry budget is exhausted
- periodic worker maintenance
- automatic cleanup of old terminal jobs and partial `.part` outputs
- operational render queue status helper

This prevents duplicate render execution, limits resource contention, and stops
abandoned render records and files from accumulating indefinitely.
