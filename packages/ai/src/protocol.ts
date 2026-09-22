/**
 * Phenova AI Editing Protocol
 *
 * The AI never mutates the timeline directly.
 * It produces a structured EditPlan that is validated and then
 * turned into TimelineEvents by the engine.
 *
 * This design makes the AI auditable, correctable, and safe.
 */

import { z } from 'zod';
import { UUID, Milliseconds } from '@phenova/core';

// ---------------------------------------------------------------------------
// Constraints – the fundamental product rules
// ---------------------------------------------------------------------------

export const EditConstraintsSchema = z.object({
  useOnlyUserFootage: z.boolean().default(true),
  allowGeneration: z.boolean().default(false),
  targetDurationMs: z.number().positive().optional(),
  style: z.string().optional(),          // "cinematic", "fast-paced", "documentary"...
  aspectRatio: z.string().optional(),    // "9:16", "16:9", "1:1"
  maxClips: z.number().int().positive().optional(),
  // User-selected answers to high-impact clarification questions.
  // These are explicit intent, not model-inferred preferences.
  criticalAnswers: z.record(z.string()).optional(),
});

export type EditConstraints = z.infer<typeof EditConstraintsSchema>;

export function compileCriticalAnswers(
  answers: Record<string, string> | undefined
): Partial<EditConstraints> {
  const a = answers ?? {};
  const out: Partial<EditConstraints> = {};

  const duration = a.duration?.match(/(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m)\b/i);
  if (duration) {
    const value = Number(duration[1]);
    const unit = duration[2].toLowerCase();
    out.targetDurationMs = Math.round(value * (unit.startsWith('m') ? 60000 : 1000));
  }

  const style = a['visual-style']?.toLowerCase();
  if (style) {
    if (style.includes('cinematic')) out.style = 'cinematic';
    else if (style.includes('minimal')) out.style = 'clean-minimal';
    else if (style.includes('dramatic') || style.includes('stylized')) out.style = 'stylized-dramatic';
    else if (style.includes('natural')) out.style = 'natural-authentic';
  }

  return out;
}


// ---------------------------------------------------------------------------
// Tools the AI is allowed to call
// ---------------------------------------------------------------------------

export type AIToolName =
  | 'select_clips'
  | 'place_clip'
  | 'trim_clip'
  | 'set_speed'
  | 'add_transition'
  | 'apply_effect'
  | 'add_keyframe'
  | 'set_mask'
  | 'track_motion'
  | 'add_text'
  | 'add_caption'
  | 'set_volume'
  | 'add_marker'
  | 'search_licensed_media'
  | 'generate_video'      // only if allowGeneration === true
  | 'generate_image'      // only if allowGeneration === true
  | 'generate_clip';      // only if allowGeneration === true

export interface ToolCall {
  tool: AIToolName;
  arguments: Record<string, unknown>;
  reasoning?: string;
}

// ---------------------------------------------------------------------------
// Edit Plan – the unit of AI work
// ---------------------------------------------------------------------------

export const EditStepSchema = z.object({
  id: z.string().uuid(),
  description: z.string(),
  toolCalls: z.array(z.object({
    tool: z.string(),
    arguments: z.record(z.unknown()),
    reasoning: z.string().optional(),
  })),
  estimatedDurationMs: z.number().optional(),
});

export type EditStep = z.infer<typeof EditStepSchema>;

export const EditPlanSchema = z.object({
  id: z.string().uuid(),
  intent: z.string(),                    // original user instruction
  constraints: EditConstraintsSchema,
  steps: z.array(EditStepSchema),
  confidence: z.number().min(0).max(1),
  requiresUserApproval: z.boolean().default(false),
  notes: z.string().optional(),
  createdAt: z.string(),
});

export type EditPlan = z.infer<typeof EditPlanSchema>;

// ---------------------------------------------------------------------------
// Correction
// ---------------------------------------------------------------------------

export interface CorrectionRequest {
  previousPlanId: string;
  instruction: string;                   // "make the transitions smoother"
  scope?: 'transitions' | 'timing' | 'effects' | 'all';
}

// ---------------------------------------------------------------------------
// High-level intents the orchestrator understands
// ---------------------------------------------------------------------------

export type HighLevelIntent =
  | { type: 'create_edit'; instruction: string; mediaIds: UUID[] }
  | { type: 'refine_edit'; instruction: string; previousPlanId: string }
  | { type: 'generate_only'; instruction: string; kind: 'video' | 'image' | 'clip' }
  | { type: 'search_media'; query: string; constraints: EditConstraints }
  | { type: 'analyze_media'; mediaIds: UUID[] };

// ---------------------------------------------------------------------------
// Tool argument schemas (for validation before execution)
// ---------------------------------------------------------------------------

export const SelectClipsArgs = z.object({
  mediaIds: z.array(z.string().uuid()),
  criteria: z.string(),                  // "best moments", "high energy", "faces"
  maxCount: z.number().int().positive().optional(),
  targetTotalDurationMs: z.number().positive().optional(),
});

export const PlaceClipArgs = z.object({
  mediaId: z.string().uuid(),
  trackType: z.enum(['video', 'audio', 'overlay']),
  timelineStartMs: z.number().nonnegative(),
  sourceInMs: z.number().nonnegative().optional(),
  sourceOutMs: z.number().nonnegative().optional(),
});

export const TrimClipArgs = z.object({
  clipId: z.string().uuid(),
  sourceInMs: z.number().nonnegative(),
  sourceOutMs: z.number().nonnegative(),
});

export const SetSpeedArgs = z.object({
  clipId: z.string().uuid(),
  speed: z.number().positive(),
  reverse: z.boolean().optional(),
});

export const AddTransitionArgs = z.object({
  clipId: z.string().uuid(),
  side: z.enum(['in', 'out']),
  transitionId: z.string(),              // "crossfade", "dip_to_black"...
  durationMs: z.number().positive(),
});

export const ApplyEffectArgs = z.object({
  clipId: z.string().uuid(),
  effectId: z.string(),
  params: z.record(z.union([z.number(), z.string(), z.boolean()])),
});

export const AddTextArgs = z.object({
  text: z.string(),
  timelineStartMs: z.number().nonnegative(),
  durationMs: z.number().positive(),
  style: z.record(z.unknown()).optional(),
});

export const GenerateVideoArgs = z.object({
  prompt: z.string().min(3),
  durationMs: z.number().positive().max(30000), // keep short for quality
  aspectRatio: z.string().optional(),
  style: z.string().optional(),
});

export const GenerateImageArgs = z.object({
  prompt: z.string().min(3),
  aspectRatio: z.string().optional(),
  style: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Safety: generation tools are gated
// ---------------------------------------------------------------------------

export function isGenerationTool(tool: AIToolName): boolean {
  return tool === 'generate_video' || tool === 'generate_image' || tool === 'generate_clip';
}

export function validatePlanAgainstConstraints(plan: EditPlan): string[] {
  const errors: string[] = [];
  if (!plan.constraints.allowGeneration) {
    for (const step of plan.steps) {
      for (const call of step.toolCalls) {
        if (isGenerationTool(call.tool as AIToolName)) {
          errors.push(`Generation tool "${call.tool}" used but allowGeneration is false`);
        }
      }
    }
  }
  if (plan.constraints.useOnlyUserFootage) {
    for (const step of plan.steps) {
      for (const call of step.toolCalls) {
        if (call.tool === 'search_licensed_media' || isGenerationTool(call.tool as AIToolName)) {
          errors.push(`Tool "${call.tool}" violates useOnlyUserFootage constraint`);
        }
      }
    }
  }
  return errors;
}
