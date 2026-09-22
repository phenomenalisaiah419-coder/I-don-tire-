# PHENOVA 1.2.0 — Proxy, Scrub Performance, ML Matting

## Implemented

| Feature | Detail |
|---------|--------|
| Proxy generation | Low-res H264 proxies + thumbs + optional filmstrip |
| Bounded concurrency | Default 2 parallel jobs |
| Scrub frames | Extract from proxy at timeMs with 100ms cache buckets |
| Filmstrip | Contact sheet + per-frame strip for timeline UI |
| API routes | /proxy/ensure, /proxy/ensure-batch, /proxy/scrub, /matting/remove-bg |
| Flutter | ProxyClient, ClipFilmstrip, playhead isolation, scroll throttle |
| ML matting | HTTP + CLI providers; chromakey fallback; no weights shipped |

## Verification
- `npm run build` — green
- timeline unit tests — 37 passed
- protocol tests — 9 passed
- ProxyManager + createMattingProviderFromEnv import OK

## Configure ML matting (optional)
```bash
export PHENOVA_MATTING_URL=http://127.0.0.1:7001/matte
# or
export PHENOVA_MATTING_CLI=rembg
```

## Still needs real-device validation
- Measured scrub FPS on mid-range Android
- Proxy generation time on large 4K sources
- End-to-end rembg/HTTP matting with a live worker
