# Phenova code audit (thorough check)

## Client (Flutter) – structural
- All `packages/client/lib/**/*.dart` files: balanced braces/parens
- MediaAsset call sites include required `source:`
- ProjectNotifier: addMedia, addClip, addTrack, updateClip present
- Transform2D.identity, Clip.durationMs / timelineEndMs present
- CapCut-style shell: Edit | Templates | AI Lab | Projects | Me
- Unique **AI Editor** on Edit, AI Lab, Me, editor top bar
- App icon: assets + Android drawable-nodpi + Manifest
- pubspec: SDK ≥3.5, Flutter ≥3.24, riverpod, video_player, file_picker, http
- Widget tests: HomeScreen shell + ExploreScreen
- PhenovaApi offline-safe with timeout

## Engine stack
- packages/engine PhenovaEditor present
- packages/ai: direct-provider, tools (add_keyframe, set_mask, track_motion)
- packages/render: compositor (pathMaskFilter, keyframeExpression, chromakey), motion-tracker, background-removal
- packages/core: capabilities + Mask/MotionTrack types

## Known environment limits (not source bugs)
- Flutter SDK not available in this environment → no `flutter analyze` / APK run here
- npm workspace install timed out earlier → no full `tsc` in this environment
- Engine bridge must be running for live AI Editor apply

## Intentional product differences vs CapCut
- Branding Phenova / Phenova AI / Phenova Pro
- AI Editor = engine-driven manual dope editing
- AI Lab = generation / ideas
- Tool order and extra CTAs differ from CapCut
