# Validated Edit Plan pipeline

The canonical execution boundary is now preceded by an explicit validation gate.

Flow:
1. Receive structured Edit Plan.
2. Validate schema.
3. Check operations against the supplied capability registry.
4. Dispatch only validated operations to the canonical executor.
5. Return renderer results.

This keeps AI/manual operation generation separate from media execution and prevents
unsupported capabilities from reaching renderers.
