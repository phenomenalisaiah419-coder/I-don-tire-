# Step 59 — Edit Plan Validation Gate

The Edit Plan path now has a strict validation boundary before canonical execution.

Checks include:
- exact supported schema version
- non-empty operation list
- maximum operation count
- operation registration against the real capability registry
- allowed timeline track types
- numeric field validation
- range validation
- required server-resolved media paths for relevant operations
- execution result status validation

The validator defaults to the real capability registry when a capability set is not
explicitly supplied. This prevents stale or hand-written client capability lists
from silently enabling unsupported operations.

No operation is treated as successfully executed unless the canonical executor
returns an explicit COMPLETED or PLANNED status.
