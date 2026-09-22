# Render job system

Edit Plan rendering now has a job lifecycle:
- QUEUED
- RUNNING
- COMPLETED
- FAILED

Jobs expose a stable ID and output/error state. The API submits the render work as a
background task and provides a status endpoint.

This is an in-process orchestration layer. Durable queue workers, persistent job
storage, cancellation, progress percentages, and resumable renders remain future
production-hardening work.
