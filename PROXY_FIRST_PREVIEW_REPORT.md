# PHENOVA 1.3.0 — Proxy-first Preview + Matting Worker

## Implemented
| Item | Detail |
|------|--------|
| PreviewPlayer | Proxy-first path resolution, auto-ensure, debounced seek, PROXY badge |
| PlayheadLayer | Independent playhead painter (playheadMsProvider) |
| Matting worker | workers/matting_server.py (rembg optional) |
| Proxy integration test | Real FFmpeg — 6 assertions passed |

## Verification
```
npm run build          # green
npx tsx tests/integration/proxy.test.ts   # all passed
npx tsx tests/unit/timeline.test.ts       # 37 passed
npx tsx tests/unit/protocol.test.ts       # 9 passed
```

## Run matting worker
```bash
pip install flask rembg pillow
python workers/matting_server.py
export PHENOVA_MATTING_URL=http://127.0.0.1:7001/matte
```

## Remaining (needs device)
- Measured scrub FPS on mid-range Android
- Proxy generation under thermal/memory pressure
