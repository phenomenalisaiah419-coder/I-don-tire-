# AI Director execution

The AI Director now has an explicit orchestration contract:
1. Gather project/media/capability/evidence context.
2. Send the actual user instruction to a configured provider.
3. Require structured Edit Plan JSON.
4. Reject malformed or unsupported plan structure.
5. Hand only validated plans to the canonical Edit Plan/execution pipeline.

No provider credentials are embedded. No plan is fabricated when a provider is absent.
Provider-specific validation and the existing capability registry remain authoritative.
