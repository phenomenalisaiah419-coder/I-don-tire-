# PHENOVA Owner Access — first-time setup and re-authentication

The Owner Access flow now matches the intended user experience:

1. The first time Owner Access is opened, the authenticated PHENOVA account can
   create the owner email and password.
2. Password confirmation is required.
3. Setup is one-time. A second setup attempt cannot replace the owner credentials.
4. After setup, the credentials are stored server-side and are never returned.
5. Owner authentication grants PHENOVA Premium.
6. If the user switches to another normal PHENOVA account, owner privileges are
   not automatically carried over; Owner Access must be authenticated again.
7. Three failed owner-authentication attempts trigger a seven-day lockout.

The client should expose:
Settings → Personalize → Build/Version Number → three taps → Owner Access.

The bootstrap setup must be tied to the currently authenticated PHENOVA account
in the production implementation so an arbitrary unauthenticated caller cannot
claim the first owner slot.
