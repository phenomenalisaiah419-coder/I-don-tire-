# Implementation status — PHENOVA Hardened Competitive Edition foundation

## Verified in this environment (2026-08-21)

### Backend (FastAPI) — TESTED / VERIFIED
- Health endpoint with FFmpeg availability flag
- JWT registration / login (PBKDF2-SHA256 password hashing)
- Project CRUD (create, list, get-by-id, delete)
- Media upload with real size limits, MIME allow-list, and optional ffprobe duration
- Media list + probe endpoint
- Edit Plan schema validation + capability-registry gating of operations
- Render jobs: real FFmpeg trim + multi-operation execute (mute, volume, speed, concat)
- Capability registry exposing implemented / partial / planned maturity
- SQLite (dev) / PostgreSQL-compatible configuration
- Provider-neutral AI interfaces (IndependentProvider, IFEC adapter stubs) — no fake AI

### Media engine — TESTED / VERIFIED (requires host FFmpeg)
- ensure_ffmpeg, probe (ffprobe JSON), trim, mute, set_volume, change_speed, concat, execute_operation
- All operations produce real output files or raise; no silent success on failure

### Tests
- 11 pytest cases passing: health, auth, projects, edit-plan schema, media engine (probe/trim/mute/volume/speed/execute)

### Flutter client — PARTIAL
- Material 3 dark shell, project list, create project, file picker
- API client for projects
- Does not yet surface full edit/render workflow UI (backend ready)

### Explicitly NOT claimed complete (per specification anti-fake rule)
- Full AI Director / agentic first-cut (requires authorized LLM/vision providers)
- Transcript surface synchronized with timeline
- Multimodal media intelligence (faces/objects/scenes)
- Smart reframing, advanced compositing/masks/tracking
- Generative media providers
- Collaboration / review
- Production object storage, payments, full entitlement enforcement
- Android APK/AAB (no Android SDK / Flutter SDK in this build environment)

### Architecture compliance
- Canonical project + versioned Edit Plan retained
- Real-media + real-FFmpeg execution
- Capability registry gates operations
- Offline/degraded: AI providers fail closed; media ops require FFmpeg
- IFEC remains optional enhancement adapter

### Build notes for this environment
- Python 3.12 + system FFmpeg 6.1 available
- Flutter / Android SDK / ANDROID_HOME not present → APK generation blocked
- RAM ~1.9 GiB → full Android Gradle builds not feasible without environment expansion
- Corrected source package is the deliverable; APK remains for a machine with Android tooling


## Step 1 — Canonical project state and ownership

Implemented and locally verified:
- authenticated project endpoints
- server-side project ownership enforcement
- canonical versioned project state JSON
- project state update endpoint
- version history endpoint (latest 20)
- restore-from-version endpoint
- initial project snapshot
- PBKDF2-SHA256 password hashing without passlib/bcrypt runtime dependency
- authentication regression tests

Verification: 13 backend tests passed in the engineering environment. This does not constitute final real-device or production verification.


## Step 2 — Real media import and validation

Implemented and locally verifiable:
- Authenticated media endpoints with project ownership enforcement
- Streaming upload with hard size limit
- SHA-256 content fingerprint
- Mandatory ffprobe validation before accepting media
- Real duration, format, video codec/dimensions/FPS, audio codec/sample-rate/channels metadata
- Corrupt/mismatched media rejection
- Persisted media metadata and validation state
- Media listing and probe access restricted to the owning user
- Integration tests for valid upload, corrupt-media rejection, and ownership isolation

The remaining media requirements include resumable/chunked uploads, production object storage, advanced malicious-file scanning, and lifecycle cleanup; these are separate production-hardening steps and are not represented as complete.

## Step 4 — Edit Plan execution and operation graph

Implemented and tested:
- executable, versioned Edit Plans
- deterministic sequential operation execution
- operation audit log with inputs, outputs, status, reason, and errors
- plan status transitions: VALIDATED → PROCESSING → COMPLETED/FAILED
- derived media assets for genuine rendered outputs
- canonical project operation history updated after successful execution
- authenticated/ownership-protected plan inspection and execution endpoints
- regression test for validated-plan execution against real FFmpeg media


## Step 54 — Canonical Edit Engine Hardening

Implemented:
- Expanded canonical capability registry for real editing operations already supported by the engine.
- Deterministic timeline operation planning for trim, cut, split, delete and reorder.
- Unified canonical execution boundary for trim/cut, concat, transforms, visual effects, transitions and audio operations.
- Edit Plan compiler now rejects structural timeline operations instead of pretending they are rendered.
- Stronger operation/range validation.
- Regression tests for timeline semantics, capability registration and unsupported operations.

No operation is marked complete merely because an API endpoint exists; the renderable
path must produce a verified FFmpeg output, while structural operations remain explicit
until compiled into the canonical project timeline.
