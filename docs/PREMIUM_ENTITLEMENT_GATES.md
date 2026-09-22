# Step 58 — Premium entitlement gates

PHENOVA Premium capabilities are now represented as server-authoritative feature
entitlements.

Premium feature gates include:
- AI premium edits
- 1080p export
- unlimited corrections
- premium templates
- advanced effects
- advanced transitions

Owner Access grants the same `PHENOVA_PREMIUM` entitlement used by legitimate
Premium access. It does not create a special client-side bypass.

The Flutter client can load the entitlement/feature map and use it to control UI,
while the backend remains the authority for protected operations.
