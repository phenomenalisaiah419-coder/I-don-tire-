# PHENOVA

AI-first professional video editor — Flutter Android client + TypeScript engine + unified gateway + optional FastAPI backend.

## Single client URL

```
http://127.0.0.1:8788
```

## Quick start

```bash
# Optional: FastAPI (auth, premium, extended /api/v1)
cd backend && pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Unified gateway (engine + FastAPI proxy)
export PHENOVA_PROVIDER_API_KEY=your_key   # optional for AI
npm run gateway

# Flutter
cd packages/client
flutter pub get
flutter run
```

## Layout

| Path | Role |
|------|------|
| `packages/client` | Flutter CapCut-style UI + **AI Editor** |
| `packages/engine` | PhenovaEditor (timeline ops, AI plans) |
| `packages/ai` | Direct provider (canonical; no mock) |
| `packages/render` | FFmpeg compositor, motion track, BG remove |
| `packages/core` | Types, capabilities, timeline model |
| `services/api` | Gateway `:8788` + engine-server + production API |
| `backend` | FastAPI competitive edition (`/api/v1`) |

## Scripts

- `npm run gateway` — **preferred** single HTTP surface
- `npm run engine` — engine only
- `npm run build` / `npm test` — TS workspace
- Codemagic: `codemagic.yaml` → Android APK/AAB

## Docs

- `PRODUCT_SPEC_AND_GAPS.md` — product intent + remaining external limits
- `CLEANUP_AUDIT.md` — dedupe / dummy removal
- `ARCHITECTURE.md` — system design

## Honest limits

- Neural matting / dense optical-flow **weights** are external hooks
- Live ASR needs provider key or `whisper` CLI
- APK requires Flutter SDK + Codemagic (or local) build
