# PHENOVA Deployment

## Environments

Three environments per spec §13: `development` (sqlite + local disk),
`staging` and `production` (PostgreSQL + object storage + HTTPS only).
Select with `PHENOVA_ENV`. Production refuses to boot without a ≥32-char
`PHENOVA_JWT_SECRET`.

## Production checklist

1. **Node 22+**, **FFmpeg 6+** and **ffprobe** installed on the host.
2. Copy `.env.example` → set all secrets. `PHENOVA_CORS_ORIGINS` must not
   be `*`. `PHENOVA_ENV=production`.
3. **Database**: default embedded sqlite (WAL) works for single-node. For
   PostgreSQL apply the migration set in `services/api/src/db` (the schema
   is standard SQL) and point the service at it.
4. **Storage**: default local disk under `PHENOVA_DATA_DIR`. Swap
   `StorageService` for an S3-compatible backend by implementing the same
   interface (`storeLocalFile`, `registerMediaFromFile`, chunked upload
   trio).
5. **TLS**: terminate HTTPS at your proxy (spec §14 — production API
   traffic is HTTPS-only; no `10.0.2.2`-style dev URLs in release builds).
6. `npm ci && npm run build && npm test` — do not deploy on a red suite.
7. `npm start` (or a process manager) — jobs resume after restarts; stale
   uploads are cleaned deterministically every hour.
8. Provider keys (`PHENOVA_PROVIDER_API_KEY`, `PEXELS_API_KEY`, `PIXABAY_API_KEY`) are
   optional enhancements; every dependent endpoint degrades to an honest
   503 when absent.
9. Android release: configure the `phenova-release` secret group in
   Codemagic (base64 keystore + passwords). The release build hard-fails
   without it — that is intentional (spec §15).

## Reproducible builds

`codemagic.yaml` pins: Node 22, java 17, flutter stable, explicit ordered
build (core → ai → render → engine → api), full test suite including real
FFmpeg renders, then signed APK + AAB artifacts.
