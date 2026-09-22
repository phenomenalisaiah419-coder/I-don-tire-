# Step 68 — Render Release Validation

PHENOVA now has a deployment/CI self-check for the render backend.

The check:
- validates the runtime render configuration
- imports every required render subsystem
- confirms the persistent render worker stack is wired
- returns a machine-readable READY result
- can run without performing a real video render

CLI:
`python backend/release_check.py`

This is a release-readiness gate, not a substitute for a real-device/media
integration render. The final release step will cover the remaining production
validation and packaging checks.
