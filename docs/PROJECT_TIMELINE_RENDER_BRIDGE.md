# Step 56 — Project Timeline → Real Render Bridge

The canonical timeline can now become an actual PHENOVA render job.

Flow:
1. Authenticated user requests a project render.
2. Server verifies project ownership.
3. Canonical timeline snapshot is loaded.
4. Timeline clip asset IDs are resolved against the project's MediaAsset records.
5. Server builds a validated Edit Plan using real server-side media paths.
6. The plan is checked by the existing project renderer compiler.
7. A persistent render job is created.
8. The existing persistent worker executes it through the real FFmpeg pipeline.

This closes the gap between timeline state and the persistent rendering system.
The client does not supply arbitrary filesystem paths; paths come from owned
MediaAsset records.
