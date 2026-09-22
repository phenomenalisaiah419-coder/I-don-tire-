# PHENOVA Code Integration Report

## Integrated change
The editor's **Split at playhead** action now updates the local Riverpod timeline state
through `ProjectNotifier.splitClipAt(...)` before synchronizing with the engine.

## Behavior
- Rejects splits outside the selected clip.
- Creates left/right clips locally with preserved source timing and clip properties.
- Attempts engine synchronization afterward.
- Keeps the local timeline usable if the engine is unavailable.

## Verification performed
- Confirmed the integrated handler exists in `packages/client/lib/screens/editor_screen.dart`.
- Confirmed `ProjectNotifier.splitClipAt` exists in `packages/client/lib/timeline/timeline_state.dart`.
- This archive has not been Flutter-build verified in this environment.

## Follow-up integration
- Cleared the timeline selection after a successful split because the original clip ID is replaced by two new clip IDs.
- This prevents downstream editing tools from operating on a stale selection.


## V3 Integration Change
- Preview playback listener now reads the latest project state through Riverpod rather than a stale build-time snapshot.
- Initial post-frame preview sync also reads current project and timeline state.

## V5 Integration
- Updated `ProjectNotifier.updateClip` to return success, avoid committing when the clip ID is missing, and re-sort clips after mutation.
- This keeps undo history clean and timeline ordering deterministic.
- Validation: source patch applied and archive rebuilt; Flutter toolchain execution remains pending.

- V8: added bounded clip-speed mutation and local mute toggle integration.

## V12 — Preview transform rendering
- PreviewPlayer now evaluates active clip keyframes and applies transform/opacity to the displayed video.
- No Flutter build was executed in this environment.


## V13 — Playback-driven transform refresh
- Added controller listener lifecycle management.
- Refreshes animated transforms from playback position.
- Prevents repeated initial-sync scheduling during rebuilds.
