# PHENOVA Pass 2

Implemented the clarification-answer-to-edit-constraint compiler.

- Duration answers are converted to targetDurationMs.
- Visual-style answers are converted to concrete style constraints.
- criticalAnswers remain attached to the EditConstraints payload.
- The AI orchestrator compiles explicit user answers before invoking the model router.
- Explicit user answers take precedence over inferred/default constraint values.

This is the second implementation pass; it does not claim Flutter/device execution.
