# PHENOVA Owner Access Flutter UI

Add a hidden three-tap entry point:
Settings → Personalize → Build/Version Number → three taps.

First-time setup:
- Query `/api/v1/owner-access/status`.
- If `configured=false`, show email, password and confirmation.
- POST `/api/v1/owner-access/setup`.
- Never store the password locally.

Returning owner:
- If configured, show email + password.
- POST `/api/v1/owner-access/authenticate`.
- Establish a privileged session only from a successful server response.
- Clear privileged state on normal account switching.
- Premium access must be based on server entitlement, not a client-side owner flag.
