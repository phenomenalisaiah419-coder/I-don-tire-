# Step 65 — Render Job API Hardening

The render-job API now exposes a safer lifecycle contract.

Implemented:
- queued cancellation immediately becomes terminal `CANCELLED`
- running cancellation remains `CANCELLING` until the worker stops
- authenticated job ownership checks remain in place
- render event history endpoint with bounded page size
- internal worker IDs and filesystem output paths are removed from normal job responses
- cancellation response reports the actual resulting state
- lifecycle regression tests

This fixes a queue-state bug where cancelling a queued job could leave it stuck
in `CANCELLING` because workers only claim `QUEUED` jobs.
