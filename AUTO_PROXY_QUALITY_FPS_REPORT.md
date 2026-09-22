# PHENOVA 1.4.0 — Auto-proxy · Preview quality · Scrub harness

## Implemented

| Feature | Detail |
|---------|--------|
| On-import auto-proxy | MediaImportService.importAndProxyAsync on every Media pick |
| Preview quality | Proxy (default) / Full toggle in editor + settings |
| Export | Unchanged — still full-res / high quality via engine export |
| Scrub bench (Node) | 20k iters, ~2.7µs/iter, all snap hits |
| Scrub bench (Flutter) | test/timeline_scrub_benchmark_test.dart for device/CI |

## Verification
```
npm run build                              # green
npx tsx tests/unit/scrub-bench.test.ts     # OK ~2.7µs/iter
npx tsx tests/integration/proxy.test.ts    # 6/6
npx tsx tests/unit/timeline.test.ts        # 37 passed
```

Flutter (on a machine with SDK):
```
cd packages/client && flutter test test/timeline_scrub_benchmark_test.dart
```

## UX
- Import media → proxy generates in background → preview switches to PROXY
- Toggle **Proxy / Full** in top bar or Settings to force original media
- Export button still requests high-quality full render
