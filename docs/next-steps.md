# Phenova – Complete Foundation + Optionals

## All core + optional features included

### Core
- Event-sourced multi-track timeline
- AI edit via IFEC (`https://platform.ifecai.com`)
- Flutter timeline interaction (select/move/trim/scrub/zoom)
- Inspector (volume, speed, effects, transitions, export)
- Proxy + preview
- Engine bridge
- MediaPipe faces + OpenCV object/person tracking
- Scene + audio analysis
- Licensed stock: Pexels, Pixabay, Unsplash
- Generation (opt-in video/image)
- filter_complex export + audio mix helper
- Live scroll-linked timeline virtualization
- Cloud sync scaffold (Memory + HTTP stores, API endpoints)
- Device QA checklist
- Timeline unit tests

### Env keys
```
PHENOVA_PROVIDER_API_KEY=...
PEXELS_API_KEY=...          # optional
PIXABAY_API_KEY=...         # optional
UNSPLASH_ACCESS_KEY=...     # optional
```

### Run
```bash
export PHENOVA_PROVIDER_API_KEY=your_key
npx ts-node services/api/src/engine-server.ts   # :8788
npx ts-node services/api/src/proxy-server.ts    # :8787 optional
```

### Product loop
Import → AI (IFEC) → Timeline → Effects → Preview → Export

No further foundation work required.
