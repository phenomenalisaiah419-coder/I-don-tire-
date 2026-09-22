# Render job progress and cancellation

Render jobs now expose:
- progress percentage
- cancellation request
- CANCELLING state
- CANCELLED terminal state
- cleanup of a produced output when cancellation is detected after rendering

Progress is deliberately reported only at verified lifecycle checkpoints (5%, 10%,
100%) because the current renderer does not yet expose FFmpeg `-progress` telemetry.
No fabricated percentage is presented as real render progress.

True mid-process process termination and fine-grained FFmpeg progress telemetry
remain the next production-hardening step.
