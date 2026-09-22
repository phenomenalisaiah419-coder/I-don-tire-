# Step 57 — Owner session + Premium entitlement

The Owner session is now connected to a server-authoritative entitlement endpoint.

Flow:
1. User logs into PHENOVA normally.
2. Owner Access authenticates the existing owner credentials.
3. Backend returns a short-lived signed Owner session token.
4. Flutter stores that token in secure storage.
5. PHENOVA asks the backend for owner entitlements.
6. `PHENOVA_PREMIUM` is granted only when the server validates the Owner session.
7. On normal logout or account switching, the Owner session must be cleared.
8. A later account must authenticate Owner Access again.

The app must not unlock Premium from a local `isOwner` flag.
The entitlement endpoint is the authority.
