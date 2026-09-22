# Step 52 — Persistent render jobs

The render-job lifecycle now has a persistent SQLite registry separate from the
in-memory job dictionary.

Implemented:
- persistent QUEUED/RUNNING/CANCELLING/COMPLETED/FAILED/CANCELLED state
- atomic worker claiming
- job lookup scoped to the authenticated account
- cancellation requests persisted
- stale RUNNING/CANCELLING recovery after interruption
- terminal-job cleanup
- worker bridge to the existing real FFmpeg progress executor
- transition/integrated renderer command selection remains centralized

This means job metadata survives a backend process restart. A deployment still
needs a real worker supervisor to start workers automatically and a protected
admin/service role for recovery/cleanup endpoints before production release.
