# Canonical executor

The canonical executor is now the single dispatch boundary for supported media
operations. AI Director plans and manual timeline operations can target registered
operation names, while the executor selects the corresponding real renderer.

Security/architecture rules:
- no arbitrary shell command execution
- unknown operations are rejected
- renderers remain responsible for output verification
- the capability registry remains the authoritative source for what should be exposed
- this dispatcher is an execution boundary, not a replacement for Edit Plan validation
