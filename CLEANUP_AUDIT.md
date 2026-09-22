# Cleanup audit — next pass

## Removed / deduped
1. **`integrations/ultimate-master`** — historical duplicate Flutter + backend tree (not runtime path). Removed from delivery tree.
2. **`packages/client/lib/main.dart` EditorShell** — was a second full editor UI with dead Export/Undo handlers and fake demo-only flows. Now a thin alias → `EditorScreen`.
3. **Template `placeholder` mediaId** — no longer invents fake media; returns warning when `mediaIds` empty.

## Intentionally kept (not dummies)
| Item | Why |
|------|-----|
| ASR `method: 'placeholder'` | Honest degraded mode when no API key / whisper — structured captions, not silent fake success |
| IFEC modules under `packages/ai` | Optional legacy; **direct-provider** is canonical export in `index.ts` |
| Backend route modules mirroring `app/*.py` | FastAPI layout (handlers + services), not accidental copies of client code |
| `seedDemoProject` | Dev helper; paths clearly synthetic |

## Errors checked
- Dart client: brace/paren balance OK on home, editor, main
- `engine-server.ts` brace balance OK
- `templates.ts` brace balance OK after mediaIds fix

## Runtime single path
- Client → **:8788 gateway** only
- Editor UI → **`screens/editor_screen.dart`** only
- AI provider → **`direct-provider`** barrel

## Still not in-sandbox
- `flutter analyze` / APK
- Full `tsc` of workspaces
