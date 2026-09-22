# AI Director app integration

The Flutter client now exposes a real AI Director screen that submits the user's
instruction and project/media context to the Director API.

Important:
- The UI does not fabricate plans.
- Provider/API errors are displayed.
- The production API endpoint must be configured for release builds.
- Plan execution remains server-authoritative through the Edit Plan system.


## V13 — Playback-driven transform refresh
- Added controller listener lifecycle management.
- Refreshes animated transforms from playback position.
- Prevents repeated initial-sync scheduling during rebuilds.
