# Step 57 — Render Verification + Atomic Publication

PHENOVA render completion is now gated by output verification.

Implemented:
- FFprobe validation after FFmpeg completes
- Reject missing/empty outputs
- Reject invalid media with no usable duration
- Require a video stream
- Optional expected-duration validation with encoder/container tolerance
- Render into a `.part` temporary file
- Atomically publish only after successful verification
- Verify the published output again
- Clean partial output on cancellation/failure

This prevents a render job from being marked COMPLETED merely because an FFmpeg
process returned successfully. The final media file must also be readable and
structurally valid.
