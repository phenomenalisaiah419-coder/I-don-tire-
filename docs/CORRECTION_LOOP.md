# Correction loop

PHENOVA corrections are non-destructive:
1. Preserve the prior canonical project/plan state.
2. Collect the user's correction instruction.
3. Rebuild context from actual project/media/capabilities/evidence.
4. Ask the configured AI Director provider for a complete replacement Edit Plan.
5. Validate it against the capability registry and canonical state.
6. Execute only the validated plan.
7. Store the new version and retain the previous version for restore.

The preparation endpoint does not fabricate an AI plan and does not mutate media.
