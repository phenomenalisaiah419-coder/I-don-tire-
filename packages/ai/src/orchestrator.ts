/**
 * Phenova AI Orchestrator
 *
 * Responsible for:
 * 1. Understanding user intent (text only or text + clips)
 * 2. Building a constrained EditPlan
 * 3. Validating the plan against product rules
 * 4. Emitting TimelineEvents when the plan is accepted
 * 5. Supporting the correction loop
 *
 * Actual LLM calls go through a directly configured PHENOVA provider router (injected).
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Project,
  MediaAsset,
  TimelineEvent,
  UUID,
} from '@phenova/core';
import { ToolExecutor, ToolContext } from './tools';
import {
  EditPlan,
  EditConstraints,
  HighLevelIntent,
  CorrectionRequest,
  validatePlanAgainstConstraints,
  EditPlanSchema,
  compileCriticalAnswers,
} from './protocol';

// ---------------------------------------------------------------------------
// Model Router interface – direct PHENOVA providers sit behind this
// ---------------------------------------------------------------------------

export interface ModelRouter {
  /**
   * Given a system prompt + user message + optional media analysis,
   * return a structured EditPlan (JSON).
   */
  generateEditPlan(params: {
    intent: string;
    constraints: EditConstraints;
    mediaSummaries: Array<{
      id: UUID;
      durationMs: number;
      scenes: number;
      hasFaces: boolean;
      qualityScore?: number;
      description?: string;
    }>;
    previousPlan?: EditPlan;
    correction?: string;
  }): Promise<EditPlan>;

  /**
   * Optional: generate pure creative content
   */
  generateVideo?(params: { prompt: string; durationMs: number; style?: string }): Promise<{ jobId: string }>;
  generateImage?(params: { prompt: string; aspect?: string }): Promise<{ jobId: string; url?: string }>;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export class AIOrchestrator {
  constructor(private router: ModelRouter) {}

  /**
   * Main entry point for “edit with words” or “edit with words + clips”
   */
  async createEditPlan(
    intent: string,
    project: Project,
    mediaIds: UUID[],
    constraints: Partial<EditConstraints> = {}
  ): Promise<EditPlan> {
    const criticalAnswers = constraints.criticalAnswers ?? {};
    const compiledAnswers = compileCriticalAnswers(criticalAnswers);
    const fullConstraints: EditConstraints = {
      useOnlyUserFootage: true,
      allowGeneration: false,
      ...constraints,
      // Explicit answers are user intent and therefore take precedence over
      // inferred/default constraint values.
      ...compiledAnswers,
      criticalAnswers,
    };

    const mediaSummaries = mediaIds
      .map(id => project.media[id])
      .filter((m): m is MediaAsset => !!m)
      .map(m => ({
        id: m.id,
        durationMs: m.durationMs,
        scenes: m.analysis?.scenes?.length ?? 0,
        hasFaces: (m.analysis?.faces?.length ?? 0) > 0,
        qualityScore: m.analysis?.qualityScore,
        description: undefined, // can be filled by vision model later
      }));

    const plan = await this.router.generateEditPlan({
      intent,
      constraints: fullConstraints,
      mediaSummaries,
    });

    // Validate schema
    const parsed = EditPlanSchema.safeParse(plan);
    if (!parsed.success) {
      throw new Error(`Invalid EditPlan from model: ${parsed.error.message}`);
    }

    // Enforce product rules
    const errors = validatePlanAgainstConstraints(parsed.data);
    if (errors.length > 0) {
      throw new Error(`EditPlan violates constraints:\n${errors.join('\n')}`);
    }

    return parsed.data;
  }

  /**
   * Correction loop – “make the transitions smoother”
   */
  async correctPlan(
    request: CorrectionRequest,
    previousPlan: EditPlan,
    project: Project
  ): Promise<EditPlan> {
    const plan = await this.router.generateEditPlan({
      intent: previousPlan.intent,
      constraints: previousPlan.constraints,
      mediaSummaries: [], // can be re-supplied
      previousPlan,
      correction: request.instruction,
    });

    const parsed = EditPlanSchema.safeParse(plan);
    if (!parsed.success) {
      throw new Error(`Invalid corrected EditPlan: ${parsed.error.message}`);
    }

    const errors = validatePlanAgainstConstraints(parsed.data);
    if (errors.length > 0) {
      throw new Error(`Corrected plan violates constraints:\n${errors.join('\n')}`);
    }

    return parsed.data;
  }

  /**
   * Convert an accepted EditPlan into TimelineEvents.
   * This is the only place AI work becomes real timeline mutations.
   */
  planToEvents(plan: EditPlan, context?: ToolContext): TimelineEvent[] {
    if (!context) {
      throw new Error('ToolContext is required to execute an EditPlan against a real timeline');
    }
    return new ToolExecutor(context).executePlan(plan);
  }
}

// ---------------------------------------------------------------------------
// Example system prompt (for the model router)
// ---------------------------------------------------------------------------

export const PHENOVA_SYSTEM_PROMPT = `
You are the AI editing brain of Phenova, a professional video editor.

RULES (never break these):
1. You produce only structured EditPlans in the exact JSON schema provided.
2. Generation tools (generate_video, generate_image, generate_clip) may ONLY be used when the constraints explicitly set allowGeneration: true.
3. When useOnlyUserFootage is true you may NEVER call generation or licensed-media search tools.
4. Prefer the user’s own footage. Only suggest generation when the user clearly asks for it.
5. Be precise with timing. Prefer shorter, tighter edits unless the user asks for longer.
6. Always explain your reasoning inside the step descriptions so the user can understand and correct you.
7. Treat constraints.criticalAnswers as explicit user decisions. Never override them with guesses.
8. If a critical answer conflicts with the original wording, prefer the explicit selected answer and reflect it in the plan.

When the user says “edit these clips” or “make a cinematic edit”, you analyze the provided media summaries and build a plan that only uses those clips.
When the user says “generate a 5-second futuristic city shot”, you are allowed to call generate_video.

Respond with a single valid EditPlan JSON object and nothing else.
`;


// PHENOVA_FINAL_CONSTRAINT_COMPILER
export type CompiledEditConstraints = {
  targetDurationMs?: number | null;
  style?: string | null;
  pacing?: string | null;
  storyFocus?: string | null;
  audioDirection?: string | null;
  sourceFocus?: string | null;
  criticalAnswers: Record<string, unknown>;
};

export function compileEditConstraints(
  criticalAnswers: Record<string, unknown> = {},
): CompiledEditConstraints {
  const out: CompiledEditConstraints = { criticalAnswers };
  for (const [key, raw] of Object.entries(criticalAnswers)) {
    const value = String(raw ?? '').trim();
    const lower = value.toLowerCase();
    if (key === 'duration') {
      const m = lower.match(/(\d+)\s*(?:sec|secs|second|seconds)/);
      if (m) out.targetDurationMs = Number(m[1]) * 1000;
    } else if (['style', 'visual-style', 'edit-style'].includes(key)) {
      out.style = lower;
    } else if (['pacing', 'pace'].includes(key)) {
      out.pacing = lower;
    } else if (['story', 'story-focus', 'focus'].includes(key)) {
      out.storyFocus = lower;
    } else if (['audio', 'music', 'audio-direction'].includes(key)) {
      out.audioDirection = lower;
    } else if (['source', 'source-focus', 'footage'].includes(key)) {
      out.sourceFocus = lower;
    }
  }
  return out;
}
