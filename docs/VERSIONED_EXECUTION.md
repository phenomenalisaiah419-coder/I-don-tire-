# Versioned correction execution

A correction is non-destructive:
- A previous version remains the parent.
- A new Edit Plan is required.
- Only schema-valid plans can enter execution preparation.
- The canonical media executor remains the only component allowed to mutate/render media.
- Execution preparation returns a version identity and parent relationship for audit/history.
