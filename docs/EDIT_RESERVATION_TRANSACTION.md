# Step 62 — Edit creation transaction

The signup/usage phase is now completed through transaction-safe edit creation.

A Free edit's daily usage increment and edit-job creation occur inside the same
database transaction. If the edit cannot be created, the usage increment rolls
back. Concurrent requests are serialized by the database transaction.

Premium/Owner edits use the same creation path but do not consume Free daily
limits because they carry the PHENOVA_PREMIUM entitlement.

The API now exposes `POST /api/v1/premium/create-edit` as the admission/creation
boundary.

This completes the current signup, first-month, daily-limit, and atomic edit
creation work. The actual media rendering pipeline can consume the created
edit-job ID afterward.
