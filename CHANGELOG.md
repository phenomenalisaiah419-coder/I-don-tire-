## Next integration pass
- Fixed numeric clamp typing in timeline UI state for Dart null-safety/type checking (`int` playhead and `double` zoom).

## Unreleased
- Added OpenRouter provider factory with zero-cost `openrouter/free` default.
- Added free-first provider registry and environment template.

# Changelog

## 1.0.0 — Full Production Launch (2026-09-17)

Implements the Master Program Specification end-to-end. Build green;
93 automated tests green, including real-FFmpeg render verification and a
full API end-to-end suite.

### Added — Core & Engine
- Capability registry (v1.0.0) as the single source of truth; UI/AI/render
  all gate on it; unsupported effects are refused, never shown.
- Versioned project snapshots (20 retained, configurable; pinned versions
  never pruned) + reviewable AI edit log (accept/reject/undo).
- Timeline operations: split, merge (contiguity-validated), drag reorder,
  ripple delete, freeze-frame insertion — all as reversible events.
- Canonical project schema validation (zod) with referential integrity;
  explicit project-level source/generation policy in the canonical model.
- Fixed undo/redo to be non-destructive (redo log retained).

### Added — Render (real FFmpeg, never simulated)
- New `RenderCompositor`: per-clip segments (trim/speed/reverse/freeze/
  effects/keyframed transform) → xfade/acrossfade transition assembly →
  multi-track overlay (PiP) → drawtext text & captions → full audio mix
  (volume/mute/delay placement/amix/limiter) → progress + cancellation.
- ffprobe probing (duration/dims/fps/codec/audio/bitrate) + magic-byte
  content validation — extensions are never trusted.
- Honest failures: 4K with sub-4K sources refused; unavailable effects
  refused; missing media refused; empty outputs treated as failure.

### Added — Production API (`services/api`)
- Auth: bcrypt(12) hashing, persistent revocable sessions (hashed at
  rest), rate-limited attempts, account-recovery flow.
- Durable store (node:sqlite WAL; migration runner; PostgreSQL-ready),
  ownership checks on every resource.
- Chunked/resumable uploads with per-chunk idempotency, size/magic-byte
  validation, quota enforcement, deterministic temp cleanup.
- Durable job queue: queued/processing/completed/failed/cancelled,
  real progress, cancel, bounded-concurrency infra retries.
- Server-enforced Free/Premium limits, daily UTC quotas (acceptance-only
  consumption), corrections caps, configurable pricing, mandatory
  server-side payment verification.
- Media acquisition via official Pexels/Pixabay APIs with full license/
  provenance metadata and CDN host allow-listing.
- Generation endpoints hard-gated by canonical project policy.

### Hardened — AI
- ToolExecutor enforces generation/source constraints at execution time
  (defense in depth): a plan that violates "user footage only" or
  "no generation" throws rather than degrading to a marker.
- IFEC remains optional: honest 503 when unconfigured; manual editing,
  rendering and export are unaffected.

### Android / CI
- Release builds require real signing (key.properties via Codemagic secret
  group); debug signing hard-fails the release build.
- Cleartext HTTP disabled in the manifest.
- Codemagic pipeline: Node 22 backend build + full test suite (real
  FFmpeg) → Flutter analyze + tests → debug APK → signed release APK + AAB.

## 1.0.1 — Direct Provider Hardening & Build Repair (2026-09-18)

### Fixed
- packages/ai/src/index.ts: proper dual export of DirectProviderClient (concrete) and DirectProviderModelRouter (adapter) so engine builds cleanly.
- packages/engine/src/editor.ts: added loadProject() for durable restore paths used by the API bridge.
- services/api/src/engine-server.ts: replaced fragile template literals; switched source-relative imports to workspace package imports (@phenova/*).
- services/api/src/proxy-server.ts: same package-import fix.
- services/api/tsconfig.json: restored clean rootDir after import cleanup.
- tests/**/*.ts: wrapped top-level await in async IIFE so tsx (CJS transform) can execute them.

### Verified
- `npm run build` — all 5 TypeScript packages compile with zero errors.
- Unit + integration tests: capability-router, timeline, protocol, render (real FFmpeg), api E2E, direct-provider-wiring — all green.
- No IFEC server dependency; PHENOVA_PROVIDER_* env vars drive OpenAI-compatible direct providers.

- Added local timeline clip splitting with source-time preservation and undo/redo integration.

- Added real clip start/end trimming operations with lock and range validation.

- V5: made updateClip transactional (no phantom undo entries for missing clips) and deterministic by re-sorting updated tracks.
\n- V7: Hardened trim-start validation against invalid source ranges and non-positive playback speed; deterministic clip ordering after trim-end updates.\n
- V10: Added reusable keyframe interpolation utility with boundary clamping and a Flutter unit test.

- V11: Added clip-level animated transform evaluation for x/y/scale/rotation/opacity with base-value preservation and unit coverage.

- V12: integrated evaluated clip transforms into PreviewPlayer rendering (position, scale, rotation, opacity, anchor).


## V13 — Playback-driven transform refresh
- Added controller listener lifecycle management.
- Refreshes animated transforms from playback position.
- Prevents repeated initial-sync scheduling during rebuilds.

- V18: integrated compositor overlay/audio filter planning and critical-question AI advisor gate.

## 1.1.0 — Feature depth pass (2026-09-22)

### Mobile timeline polish
- Magnetic snap for playhead scrub and clip move (edges, playhead, zero)
- Zoom stop helpers and visible-window virtualization helpers retained/improved
- Performance notes for reduced rebuilds on playhead-only updates

### Effect library depth (real FFmpeg)
- Added: hue, curves, colorbalance, eq, unsharp, boxblur, edgedetect, negate, sepia, mono, fade_in/out, mirror, rotate, pixelate
- All mapped to real FFmpeg filters in the compositor (no stubs)

### Color grading
- Expanded color_correct / color_grade path plus dedicated curves, colorbalance, hue, sepia, mono

### Audio (closer to Fairlight-lite)
- audio_volume, audio_fade, audio_eq (bass/treble), audio_compress, audio_limiter, audio_denoise, audio_normalize (loudnorm), highpass/lowpass, partial duck
- Applied from clip.effects in the real render audio chain

### Motion / ML matting
- background_removal remains partial: real chromakey+despill always; external ML via hook
- Motion tracker documents optical-flow / external tracker hooks; geometric fallback always available

### Templates marketplace
- Expanded catalog (15 templates) across For You / Daily life / Pro / Cinematic / Ads / Social
- Categories API, premium flags, aspect hints, richer apply plans (looks, text, transitions, Ken Burns, CTA)

### Flutter UI catalogs
- effects_catalog.dart expanded to match engine capabilities
- Audio tool entries for EQ / compressor / denoise / normalize / fade

## 1.2.0 — Proxy / scrub / ML matting pass (2026-09-22)

### Proxy generation for smooth scrub
- ProxyManager: bounded concurrency, progress callbacks, filmstrip contact sheets
- Per-media scrub frame cache (100ms buckets) from proxy
- API: POST /proxy/ensure, /proxy/ensure-batch, GET /proxy/scrub
- Flutter ProxyClient updated for ensure + scrub + batch

### Timeline performance
- Throttled horizontal scroll rebuilds
- playheadMsProvider + syncPlayhead for high-frequency scrub without full track rebuild
- ClipFilmstrip widget for strip/thumb display on timeline clips

### External ML matting
- HttpMattingProvider + CliMattingProvider (rembg-style)
- Env: PHENOVA_MATTING_URL, PHENOVA_MATTING_API_KEY, PHENOVA_MATTING_CLI, PHENOVA_MATTING_MODEL
- background-removal auto-tries ML then falls back to chromakey
- API: POST /matting/remove-bg

## 1.3.0 — Proxy-first preview + matting worker (2026-09-22)

### Proxy-first preview player
- Always prefers MediaAsset.proxyPath / resolved proxy over full-res
- Background /proxy/ensure when media has no proxy; hot-swaps when ready
- Debounced seek (16ms) + micro-seek skip (<40ms) for fluid scrub
- PROXY / FULL badge on preview surface

### Timeline rebuild isolation
- PlayheadLayer widget paints from playheadMsProvider only
- Existing scroll throttle + magnetic snap retained

### Matting worker
- workers/matting_server.py — Flask + optional rembg
- PHENOVA_MATTING_URL=http://127.0.0.1:7001/matte

### Tests
- tests/integration/proxy.test.ts — real FFmpeg proxy, thumb, filmstrip, scrub, batch, cache hit

## 1.4.0 — Auto-proxy import, preview quality toggle, scrub FPS harness (2026-09-22)

### On-import auto-proxy
- MediaImportService: addMedia + background proxy/thumb/filmstrip
- importAndProxyAsync keeps UI responsive (fire-and-forget)
- updateMedia writes proxyPath/thumbnailPath back into project
- Editor Media dock uses async auto-proxy on every import

### Preview quality toggle
- PreviewQuality.proxy | full (default proxy)
- Editor top-bar chip + Settings segmented control
- PreviewPlayer honors quality (full forces original path)
- Settings: "Generate missing proxies" action

### Scrub FPS harness
- packages/client/test/timeline_scrub_benchmark_test.dart (flutter test)
- tests/unit/scrub-bench.test.ts (Node micro-bench, ~2.7µs/iter)
