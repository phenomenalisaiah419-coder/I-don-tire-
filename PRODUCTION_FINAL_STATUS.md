# PHENOVA — Final delivery status

## Delivered in this tree

1. **Unified gateway** `:8788` (engine in-process + `/api/v1` → FastAPI)
2. **CapCut-style Flutter shell** — Edit | Templates | AI Lab | Projects | Me
3. **AI Editor** — confirmation UI → engine `aiEditAndApply`
4. **Editor dock** — speed, reverse, effects, split, chroma, BG remove, motion → EngineClient + local state
5. **Templates / AutoCut / ASR** services under `services/api/src/services/`
6. **Auth / entitlements** — engine routes + Flutter AuthService / ProfileScreen
7. **FastAPI backend** restored (215+ modules, AST-clean)
8. **Direct AI provider** path (no IFEC required)
9. **FFmpeg render** compositor + motion tracker + chromakey BG remove
10. **Cleanup** — no `integrations/` duplicate tree; EditorShell alias only; no fake template mediaIds

## Verified in-sandbox

- Dart/TS brace balance: pass
- Python backend AST: pass
- integrations/ absent
- ZIP excludes node_modules

## Not verified in-sandbox (environment)

- `flutter analyze` / `flutter test` / APK
- Full `npm ci && npm run build && npm test`
- Live provider + FFmpeg E2E on real media

## Run on a real machine before production claims

```bash
npm ci && npm run build && npm test
npm run gateway
cd packages/client && flutter pub get && flutter analyze && flutter test && flutter build apk
cd ../../backend && pytest
```
