# Step 60 — Persistent usage limits

PHENOVA Free daily edit usage is now persisted by authenticated account and UTC
calendar date.

Tracked:
- Basic edits/day
- Pro edits/day

The backend exposes:
- current usage
- edit-admission check
- edit recording

Premium/Owner users are not blocked by these daily limits, while usage can still
be recorded later for auditing.

The remaining integration is to obtain each account's real signup date from the
existing user model and pass the calculated age into the policy, and to make the
actual edit-creation workflow perform an atomic admission + usage reservation so
two simultaneous requests cannot bypass a daily limit.
