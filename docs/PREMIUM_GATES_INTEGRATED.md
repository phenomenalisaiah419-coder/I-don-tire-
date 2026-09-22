# Step 59 — Premium gates integrated with plan policy

The Premium entitlement now resolves through one server-side PHENOVA plan policy.

Premium:
- 1080p
- up to 15 clips, each up to 5 minutes
- one video up to 2 hours
- unlimited corrections
- no one-edit-per-day restriction

Free policy:
- first month: 1 Pro edit/day plus 2 Basic edits/day
- first 3 days of the Pro path at 1080p
- remaining first month at 720p for the Basic path
- after the first month: 2 Basic edits/day at 720p
- Basic upload limits: 5 clips × 5 minutes or 30-minute video
- 5 corrections per completed edit

Owner Access receives the same PHENOVA_PREMIUM entitlement, so it resolves through
the same policy rather than a separate owner-only editing implementation.
The current API provides policy and edit-admission checks; persistent usage counters
and exact signup-date wiring must be connected to the existing user/account data.
