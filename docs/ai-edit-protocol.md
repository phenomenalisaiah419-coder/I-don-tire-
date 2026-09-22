# AI Edit Protocol

## Fundamental Rules

1. **Generation is opt-in.**  
   Default constraints set `allowGeneration: false` and `useOnlyUserFootage: true`.

2. **AI never writes the timeline directly.**  
   It produces a validated `EditPlan`. The plan is turned into `TimelineEvent`s only after acceptance.

3. **Correction is first-class.**  
   User can say “make the transitions smoother” and the system produces a new plan that preferably only touches the relevant parts.

## Flow

```
User instruction
      │
      ▼
AI Orchestrator (packages/ai)
      │
      │  calls Model Router (IFEC)
      ▼
EditPlan (structured JSON)
      │
      │  validated against constraints
      ▼
User reviews / accepts
      │
      ▼
ToolExecutor → TimelineEvents
      │
      ▼
Timeline Engine applies events
      │
      ▼
New ProjectState + version
```

## Example Intents

**Pure text + clips (no generation)**
```
“Take these 15 clips and make me a 30-second cinematic edit.”
→ constraints.useOnlyUserFootage = true
→ constraints.allowGeneration = false
→ AI selects best moments, builds timeline, adds transitions & color
```

**Correction**
```
“Keep my existing edit but make the transitions smoother.”
→ previousPlan is supplied
→ new plan only modifies transition-related steps
```

**Generation (explicit)**
```
“Generate a 5-second futuristic city establishing shot.”
→ constraints.allowGeneration = true
→ calls generate_video tool
```

## Safety

`validatePlanAgainstConstraints` rejects any plan that tries to generate or pull licensed media when the user did not allow it.

This is enforced both in the TypeScript layer and should also be enforced in the model system prompt.
