
## V6 integration
- Trim-start mutations now preserve deterministic timeline ordering by sorting clips after the start changes.
- `removeClip` now returns `bool` and does not create an undo entry when the requested clip does not exist.
- This is a source-level integration change; Flutter compilation/device validation remains pending.


## V13 — Playback-driven transform refresh
- Added controller listener lifecycle management.
- Refreshes animated transforms from playback position.
- Prevents repeated initial-sync scheduling during rebuilds.
