# PHENOVA Production Audit and Remediation Plan

Date: 2026-09-18
Basis: PHENOVA Master Program Specification and repository source inspection.

## Executive summary

The repository has a substantial multi-package implementation: Flutter client, TypeScript core/engine/AI/render packages, a gateway, FastAPI backend, and supporting services. The repository's existing status documents correctly state that Flutter analysis/tests/APK generation, clean TypeScript installation/build/tests, and live real-media end-to-end verification were not confirmed.

This package is therefore classified as **engineering review / pre-release**, not as verified production-ready software.

## Evidence-backed findings

### A. Build and test verification

- Node 22.16.0 and npm 10.9.2 are available in the review environment.
- `node_modules` is absent from the extracted repository.
- Flutter is not executable in the review environment.
- No APK/AAB build was performed here.
- A clean dependency installation and complete test pass remain required.

Required verification:
1. `npm ci`
2. `npm run build`
3. `npm test`
4. `cd backend && pytest`
5. `cd packages/client && flutter pub get && flutter analyze && flutter test`
6. `flutter build apk --release` and, for distribution, `flutter build appbundle --release`

### B. Rendering and media

- The source includes FFmpeg-oriented rendering components.
- The repository documents external hooks for neural matting and dense optical-flow models.
- ASR includes a structured placeholder fallback when no provider/Whisper executable is available.

Release rule:
- Placeholder or unavailable capability states must never be presented as successful production processing.
- Capability registry responses must distinguish implemented, provider-required, unavailable, and planned.
- Real media fixtures must verify actual output files, duration, streams, codecs, audio behavior, and expected edits.

### C. Backend and persistence

- Backend settings default to SQLite.
- Database initialization uses SQLAlchemy metadata creation rather than an evident migration workflow in the inspected entry point.
- Production must use PostgreSQL or an equivalent durable database with versioned migrations.
- Ownership checks, authorization, and job state transitions require integration tests across every project/media/render route.

Required remediation:
- Introduce Alembic migrations.
- Make production database configuration mandatory.
- Add unique constraints, indexes, foreign keys, timestamps, soft-delete/version policies, and transactional job state transitions.
- Add tenant/user ownership checks to every resource access path.

### D. Gateway and transport security

- Gateway defaults are local HTTP URLs for development.
- CORS headers are permissive in the inspected proxy path.
- Production must terminate HTTPS, restrict allowed origins, avoid exposing internal upstream details, and avoid returning infrastructure URLs in client-facing errors.
- Provider keys must remain server-side.

Required remediation:
- Separate development and production configuration.
- Require explicit production API base URL.
- Configure allowlisted origins.
- Add request size limits, rate limiting, structured error responses, correlation IDs, and upstream timeout policies.
- Do not expose upstream hostnames or internal deployment hints to ordinary clients.

### E. Quotas and entitlements

The master specification requires server-side enforcement of:
- Free and Premium plans.
- UTC daily reset.
- Accepted distinct edit jobs consuming quota.
- Infrastructure retries not consuming quota.
- Correction allowance behavior.
- Configurable pricing and server-side payment verification.

Required verification:
- Quota decisions must be transactional and idempotent.
- A job must have a stable idempotency key.
- Accepted, rejected, retried, cancelled, and failed jobs must have explicit accounting semantics.
- Entitlements must be checked server-side, never trusted from Flutter state.

## Priority backlog

### P0 — release blockers
1. Clean install and compile all TypeScript workspaces.
2. Run Flutter analyze/tests and release APK/AAB build.
3. Run backend tests and real-media render tests.
4. Verify authentication, authorization, ownership, and production secret configuration.
5. Verify quota accounting under concurrency.
6. Verify no-generation policy enforcement.
7. Verify generated/acquired media provenance and rights metadata.
8. Verify durable job recovery, cancellation, retry, and cleanup.

### P1 — production hardening
1. PostgreSQL + Alembic migrations.
2. Restricted CORS and HTTPS-only production deployment.
3. Rate limiting and upload limits.
4. Durable object storage abstraction.
5. Observability: logs, metrics, traces, job latency, error rates.
6. Capability registry linked to actual test coverage.
7. Device testing on supported Android hardware.

### P2 — scale and operational maturity
1. Worker pools with bounded concurrency and backpressure.
2. Proxy/media cache lifecycle management.
3. Automated disaster recovery checks.
4. Performance budgets for timeline scrubbing and rendering.
5. Provider fallback and circuit-breaker policies.

## Acceptance evidence required

Each launch feature should have:
- A test or reproducible verification command.
- Input fixture(s).
- Expected persisted state.
- Expected rendered/media output where applicable.
- Error and unsupported-capability behavior.
- Ownership/security coverage.
- A clear status: verified, partially verified, unavailable, or not implemented.
