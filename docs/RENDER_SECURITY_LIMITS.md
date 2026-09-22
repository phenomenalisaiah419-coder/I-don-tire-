# Step 63 — Render Security + Resource Limits

PHENOVA now has a renderer-facing security/resource gate.

Implemented:
- media-root path confinement for render inputs
- media-root path confinement for render outputs
- configurable total input-size budget
- configurable maximum render duration
- configurable video/audio/overlay layer budgets
- validation occurs before renderer execution
- regression tests

Authentication/authorization and render safety remain separate concerns:
account/project authorization determines who may request a render, while this
gate limits what the renderer is allowed to execute.
