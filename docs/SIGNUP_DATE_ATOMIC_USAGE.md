# Step 61 — Signup date + atomic usage

Free-plan policy now calculates first-month status from the authenticated user's
`created_at` (or `signup_at`) field when available.

Daily Basic/Pro usage is reserved atomically with a SQLite `BEGIN IMMEDIATE`
transaction, preventing concurrent requests from both consuming the same remaining
slot.

Premium/Owner users bypass Free daily limits through the same
`PHENOVA_PREMIUM` entitlement.

The final integration requirement is to connect `reserve-edit` to the actual edit
creation transaction so a reserved slot and an actual created edit cannot diverge.
