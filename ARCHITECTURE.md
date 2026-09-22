# Phenova Architecture

## 1. Design Goals

- CapCut-class manual editing power
- Native AI editing that works from pure language or language + media
- First-class AI generation (video / clip / image) that is always opt-in
- Non-destructive, versioned, event-sourced projects
- Modular so any major subsystem can be replaced without rewriting the rest
- High performance on mobile and desktop
- Production-ready from day one (no “MVP then rewrite”)

## 2. High-Level Layers

```
┌──────────────────────────────────────────────────────────────┐
│                     Flutter Client                           │
│  Project · Timeline · Preview · Inspector · AI Chat Panel    │
└────────────────────────────┬─────────────────────────────────┘
                             │ gRPC / WebSocket / local bridge
┌────────────────────────────▼─────────────────────────────────┐
│                     Phenova Core                             │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ Timeline    │  │ Media        │  │ AI Orchestrator    │  │
│  │ Engine      │  │ Intelligence │  │                    │  │
│  │             │  │              │  │ Intent → Plan →    │  │
│  │ Event store │  │ Scenes       │  │ Tools → Correction │  │
│  │ Effects     │  │ Tracking     │  │                    │  │
│  │ graph       │  │ Audio        │  │ IFEC Router        │  │
│  │             │  │ Embeddings   │  │                    │  │
│  └──────┬──────┘  └──────┬───────┘  └─────────┬──────────┘  │
│         │                │                    │             │
│         └────────────────┼────────────────────┘             │
│                          │                                  │
│                 ┌────────▼────────┐                         │
│                 │ Render Pipeline │                         │
│                 │ FFmpeg + GPU    │                         │
│                 │ Compositor      │                         │
│                 └────────┬────────┘                         │
└──────────────────────────┼──────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
   User Media        Licensed Media     Generated Media
```

## 3. Timeline Data Model (Event-Sourced)

Every change is an immutable event. The current project state is the fold of all events.

This gives:
- Perfect undo / redo
- Named versions / drafts
- Collaborative potential later
- AI can propose a set of events instead of mutating state directly

Key entities:
- `Project`
- `Track` (video / audio / text / overlay)
- `Clip` (reference to media + in/out + transform + effects)
- `Effect` / `Transition` / `Keyframe`
- `Marker` / `Caption`

See `packages/core/src/timeline.ts` for the full TypeScript definitions.

## 4. AI Editing Protocol

The AI never writes the timeline directly. It produces a structured **EditPlan**.

```typescript
interface EditPlan {
  intent: string;
  steps: EditStep[];
  constraints: {
    useOnlyUserFootage: boolean;
    targetDurationMs?: number;
    style?: string;
  };
  confidence: number;
}
```

Each `EditStep` maps to one or more timeline events (add clip, set transition, apply effect, etc.).

The correction loop:
1. User gives instruction
2. AI produces EditPlan
3. Plan is applied → new version
4. User can say “make transitions smoother” → new plan that only touches transitions
5. User can reject or refine

This is defined in `packages/ai/src/protocol.ts`.

## 5. Render Pipeline

- Proxy generation for smooth scrubbing
- Multi-resolution caching
- Node-based effect graph evaluated by the compositor
- Final export via FFmpeg with GPU acceleration where available
- Support for 4K, high-quality codecs, aspect ratio presets

See `packages/render`.

## 6. Media Intelligence

Responsible for:
- Shot / scene boundary detection
- Object & face tracking
- Audio beat / energy / silence analysis
- Quality scoring
- Semantic embeddings of clips (so AI can “find the best moments”)

Can run on-device (MediaPipe) or in workers.

## 7. Generation Isolation

Generation lives behind an explicit tool:

```
generate_video({ prompt, duration, style })
generate_image({ prompt, aspect })
```

These tools are only callable when the user’s intent clearly requests generation. The default path for “edit my clips” never calls them.

## 8. Extensibility & Updatability

- All external providers (LLM, vision, stock media, generation) sit behind interfaces
- Schema versions on Project and EditPlan
- Feature flags for experimental effects / AI capabilities
- Clear package boundaries so teams can own Timeline, AI, Render, Client independently

## 9. Performance Targets

- 60 fps timeline scrubbing with proxies
- Real-time preview of most effects
- Background proxy & analysis jobs
- Efficient memory use on mid-range mobile devices

## 10. Security & Rights

- No secrets in client
- All generation and licensed media calls go through authenticated backend
- Clear provenance tracking on every media asset (user / licensed / generated)
