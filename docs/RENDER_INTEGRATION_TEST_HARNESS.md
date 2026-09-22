# Step 66 — Render Integration Test Harness

PHENOVA now has a full render-pipeline preflight contract that runs the same
non-FFmpeg gates used by the renderer:

Edit Plan validation → Render Plan compilation → Media Graph validation →
FFprobe input validation → resource/security budget.

It stops before FFmpeg and reports `READY_FOR_RENDER` when the complete contract
passes.

This provides a CI-friendly integration layer for testing the editor/render
contract without requiring a real render for every backend test.


## V13 — Playback-driven transform refresh
- Added controller listener lifecycle management.
- Refreshes animated transforms from playback position.
- Prevents repeated initial-sync scheduling during rebuilds.
