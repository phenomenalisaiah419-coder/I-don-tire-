# PHENOVA Feature Depth Pass Report (1.1.0)

## What was added / fixed

| Area | Change | Status |
|------|--------|--------|
| Mobile timeline polish | Magnetic snap on scrub + move; zoom stops; virtualization helpers | Implemented in Flutter source |
| Effect library | 15+ new real FFmpeg effects in registry + compositor | Implemented & builds |
| Color grading | curves, colorbalance, hue, sepia, mono, expanded color_correct | Implemented (not Resolve-class) |
| Audio | EQ, compressor, limiter, denoise, loudnorm, fades, HP/LP | Implemented in render chain |
| Motion / matting | Honest partial + chromakey; external ML hooks documented | Partial (no neural weights shipped) |
| Templates marketplace | 15 templates, categories, richer apply plans | Implemented in API service |

## Verification

```
npm run build   # all packages green
npx tsx tests/unit/timeline.test.ts   # 37 passed
npx tsx tests/unit/protocol.test.ts   # 9 passed
```

## Still limited (honest)

- No shipped neural models for dense optical flow / person matting
- Flutter analyze / real-device scrub FPS not measured in this environment
- Audio is FFmpeg-filter based, not a full Fairlight DAW
- Color is filter-based, not a Resolve color page
- Templates are catalog + plan apply, not a social marketplace with user uploads

## How to run

```bash
cd psrc
npm install --registry https://registry.npmjs.org
npm run build
npm test   # or individual npx tsx tests/...
npm run gateway
cd packages/client && flutter pub get && flutter run
```
