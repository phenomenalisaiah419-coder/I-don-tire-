# PHENOVA — Product intent, inventory, gaps (updated)

## Product intent
AI-first professional video editor: Flutter client + unified gateway + engine + optional FastAPI.

## Unified gateway (CLOSED)
- **Single client base URL: `:8788`**
- `services/api/src/gateway.ts` routes engine paths in-process and proxies `/api/v1/*` → FastAPI `:8000`
- Run: `npm run gateway` (or `npx tsx services/api/src/gateway.ts`)
- Also: `npm run engine` for engine-only without FastAPI proxy

## Templates / AutoCut / ASR (IMPLEMENTED as services)
| Feature | Implementation |
|---------|----------------|
| Templates | `services/api/src/services/templates.ts` — catalog + apply plan steps; UI Templates tab fetches `/templates` |
| AutoCut | `services/api/src/services/autocut.ts` — FFmpeg scene detect → cut points; uniform fallback |
| ASR | `services/api/src/services/asr.ts` — OpenAI-compatible `/v1/audio/transcriptions`, whisper CLI, structured placeholder |

## Motion / matting (IMPROVED)
| Feature | Implementation |
|---------|----------------|
| Motion | opticalFlowStep hook + frame extract + externalTracker + geometric bakeToPath/Rects |
| BG remove | chromakey + despill + alpha feather; externalMatting hook for ML models |

## Auth / Me / Pro (WIRED)
| Feature | Implementation |
|---------|----------------|
| Auth | `/auth/login`, `/auth/me` on engine; Flutter tries `/api/v1/auth/login` first |
| Entitlements | `/entitlements` + optional FastAPI premium routes |
| Me tab | ProfileScreen reads AuthScope + Refresh Pro |

## Remaining honesty
- Bundled neural matting / real dense optical flow **models** are still external hooks (not shipped weights)
- ASR placeholder when no key/whisper
- FastAPI must be running for full `/api/v1` premium/auth surface
- Flutter/APK not executed in this sandbox

## Runbook
```bash
# Terminal A – FastAPI (optional but recommended)
cd backend && pip install -r requirements.txt && uvicorn app.main:app --port 8000

# Terminal B – Unified gateway
export PHENOVA_PROVIDER_API_KEY=...
npm run gateway

# Flutter
cd packages/client && flutter pub get && flutter run
# Client baseUrl remains http://127.0.0.1:8788
```
