# Step 56 — Real PHENOVA authentication integration

Owner Access no longer relies on the temporary `X-Account-Id` header.

The Owner Access routes now use PHENOVA's existing `get_current_user` bearer-token
authentication. Therefore:
- setup requires a real logged-in PHENOVA account;
- the server obtains the account ID from the verified JWT;
- switching normal accounts changes the authenticated identity;
- the Owner Access credentials remain bound to the original PHENOVA account.

Successful Owner authentication also creates a short-lived, signed privileged
Owner session token (1 hour). The token contains the verified PHENOVA account ID
and an owner claim and is signed with PHENOVA's existing JWT secret.

The client must retain the Owner session only for the active privileged session and
clear it when the normal PHENOVA account changes or logs out. Authorization should
continue to be checked server-side.
