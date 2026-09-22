# Step 55 — Owner account binding

First-time Owner Access setup requires an already authenticated PHENOVA account and
binds the Owner identity to that account. Later owner authentication checks the
current account identity plus owner email/password.

A different normal PHENOVA account cannot inherit owner privileges.

The API currently represents the authenticated account with `X-Account-Id` as an
integration placeholder. Production authentication middleware must replace this
with the real authenticated session identity; the client must never invent it.
