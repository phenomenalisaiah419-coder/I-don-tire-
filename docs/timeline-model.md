# Timeline Data Model

Phenova uses an **event-sourced** timeline.

## Why Event Sourcing?

- Perfect undo / redo
- Named versions / drafts with zero extra cost
- AI can propose a list of events instead of mutating state
- Future collaboration becomes natural
- Every change is auditable

## Core Entities

- **Project** – settings + tracks + media catalog
- **Track** – video / audio / text / overlay / adjustment
- **Clip** – reference to a MediaAsset + source range + timeline placement + transform + effects + keyframes
- **MediaAsset** – the actual file with provenance (user / licensed / generated)
- **EffectInstance / TransitionInstance / Keyframe**

## Source of Truth

```typescript
interface ProjectState {
  project: Project;          // derived view
  events: TimelineEvent[];   // the real source of truth
  currentIndex: number;      // undo/redo pointer
  namedVersions: ...;
}
```

Applying an event is a pure function:

```typescript
applyEvent(state, event) → newState
```

This function lives in `packages/core/src/timeline.ts` and is shared between client, server, and workers.

## AI Integration

The AI produces an `EditPlan`.  
When the user accepts the plan, the orchestrator converts the plan’s tool calls into a sequence of `TimelineEvent`s and applies them.  
A special `AI_PLAN_APPLIED` event is recorded so the history knows an AI step occurred.

## Versioning

- `schemaVersion` on the Project
- Migration functions will be added when the schema evolves
- Old projects remain loadable
