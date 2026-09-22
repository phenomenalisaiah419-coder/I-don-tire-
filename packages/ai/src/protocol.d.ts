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
import { UUID } from '@phenova/core';
export declare const EditConstraintsSchema: z.ZodObject<{
    useOnlyUserFootage: z.ZodDefault<z.ZodBoolean>;
    allowGeneration: z.ZodDefault<z.ZodBoolean>;
    targetDurationMs: z.ZodOptional<z.ZodNumber>;
    style: z.ZodOptional<z.ZodString>;
    aspectRatio: z.ZodOptional<z.ZodString>;
    maxClips: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    allowGeneration: boolean;
    useOnlyUserFootage: boolean;
    style?: string | undefined;
    targetDurationMs?: number | undefined;
    aspectRatio?: string | undefined;
    maxClips?: number | undefined;
}, {
    allowGeneration?: boolean | undefined;
    style?: string | undefined;
    useOnlyUserFootage?: boolean | undefined;
    targetDurationMs?: number | undefined;
    aspectRatio?: string | undefined;
    maxClips?: number | undefined;
}>;
export type EditConstraints = z.infer<typeof EditConstraintsSchema>;
export type AIToolName = 'select_clips' | 'place_clip' | 'trim_clip' | 'set_speed' | 'add_transition' | 'apply_effect' | 'add_keyframe' | 'set_mask' | 'track_motion' | 'add_text' | 'add_caption' | 'set_volume' | 'add_marker' | 'search_licensed_media' | 'generate_video' | 'generate_image' | 'generate_clip';
export interface ToolCall {
    tool: AIToolName;
    arguments: Record<string, unknown>;
    reasoning?: string;
}
export declare const EditStepSchema: z.ZodObject<{
    id: z.ZodString;
    description: z.ZodString;
    toolCalls: z.ZodArray<z.ZodObject<{
        tool: z.ZodString;
        arguments: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        reasoning: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        tool: string;
        arguments: Record<string, unknown>;
        reasoning?: string | undefined;
    }, {
        tool: string;
        arguments: Record<string, unknown>;
        reasoning?: string | undefined;
    }>, "many">;
    estimatedDurationMs: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    id: string;
    description: string;
    toolCalls: {
        tool: string;
        arguments: Record<string, unknown>;
        reasoning?: string | undefined;
    }[];
    estimatedDurationMs?: number | undefined;
}, {
    id: string;
    description: string;
    toolCalls: {
        tool: string;
        arguments: Record<string, unknown>;
        reasoning?: string | undefined;
    }[];
    estimatedDurationMs?: number | undefined;
}>;
export type EditStep = z.infer<typeof EditStepSchema>;
export declare const EditPlanSchema: z.ZodObject<{
    id: z.ZodString;
    intent: z.ZodString;
    constraints: z.ZodObject<{
        useOnlyUserFootage: z.ZodDefault<z.ZodBoolean>;
        allowGeneration: z.ZodDefault<z.ZodBoolean>;
        targetDurationMs: z.ZodOptional<z.ZodNumber>;
        style: z.ZodOptional<z.ZodString>;
        aspectRatio: z.ZodOptional<z.ZodString>;
        maxClips: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        allowGeneration: boolean;
        useOnlyUserFootage: boolean;
        style?: string | undefined;
        targetDurationMs?: number | undefined;
        aspectRatio?: string | undefined;
        maxClips?: number | undefined;
    }, {
        allowGeneration?: boolean | undefined;
        style?: string | undefined;
        useOnlyUserFootage?: boolean | undefined;
        targetDurationMs?: number | undefined;
        aspectRatio?: string | undefined;
        maxClips?: number | undefined;
    }>;
    steps: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        description: z.ZodString;
        toolCalls: z.ZodArray<z.ZodObject<{
            tool: z.ZodString;
            arguments: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            reasoning: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            tool: string;
            arguments: Record<string, unknown>;
            reasoning?: string | undefined;
        }, {
            tool: string;
            arguments: Record<string, unknown>;
            reasoning?: string | undefined;
        }>, "many">;
        estimatedDurationMs: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        description: string;
        toolCalls: {
            tool: string;
            arguments: Record<string, unknown>;
            reasoning?: string | undefined;
        }[];
        estimatedDurationMs?: number | undefined;
    }, {
        id: string;
        description: string;
        toolCalls: {
            tool: string;
            arguments: Record<string, unknown>;
            reasoning?: string | undefined;
        }[];
        estimatedDurationMs?: number | undefined;
    }>, "many">;
    confidence: z.ZodNumber;
    requiresUserApproval: z.ZodDefault<z.ZodBoolean>;
    notes: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    intent: string;
    constraints: {
        allowGeneration: boolean;
        useOnlyUserFootage: boolean;
        style?: string | undefined;
        targetDurationMs?: number | undefined;
        aspectRatio?: string | undefined;
        maxClips?: number | undefined;
    };
    steps: {
        id: string;
        description: string;
        toolCalls: {
            tool: string;
            arguments: Record<string, unknown>;
            reasoning?: string | undefined;
        }[];
        estimatedDurationMs?: number | undefined;
    }[];
    confidence: number;
    requiresUserApproval: boolean;
    notes?: string | undefined;
}, {
    id: string;
    createdAt: string;
    intent: string;
    constraints: {
        allowGeneration?: boolean | undefined;
        style?: string | undefined;
        useOnlyUserFootage?: boolean | undefined;
        targetDurationMs?: number | undefined;
        aspectRatio?: string | undefined;
        maxClips?: number | undefined;
    };
    steps: {
        id: string;
        description: string;
        toolCalls: {
            tool: string;
            arguments: Record<string, unknown>;
            reasoning?: string | undefined;
        }[];
        estimatedDurationMs?: number | undefined;
    }[];
    confidence: number;
    requiresUserApproval?: boolean | undefined;
    notes?: string | undefined;
}>;
export type EditPlan = z.infer<typeof EditPlanSchema>;
export interface CorrectionRequest {
    previousPlanId: string;
    instruction: string;
    scope?: 'transitions' | 'timing' | 'effects' | 'all';
}
export type HighLevelIntent = {
    type: 'create_edit';
    instruction: string;
    mediaIds: UUID[];
} | {
    type: 'refine_edit';
    instruction: string;
    previousPlanId: string;
} | {
    type: 'generate_only';
    instruction: string;
    kind: 'video' | 'image' | 'clip';
} | {
    type: 'search_media';
    query: string;
    constraints: EditConstraints;
} | {
    type: 'analyze_media';
    mediaIds: UUID[];
};
export declare const SelectClipsArgs: z.ZodObject<{
    mediaIds: z.ZodArray<z.ZodString, "many">;
    criteria: z.ZodString;
    maxCount: z.ZodOptional<z.ZodNumber>;
    targetTotalDurationMs: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    mediaIds: string[];
    criteria: string;
    maxCount?: number | undefined;
    targetTotalDurationMs?: number | undefined;
}, {
    mediaIds: string[];
    criteria: string;
    maxCount?: number | undefined;
    targetTotalDurationMs?: number | undefined;
}>;
export declare const PlaceClipArgs: z.ZodObject<{
    mediaId: z.ZodString;
    trackType: z.ZodEnum<["video", "audio", "overlay"]>;
    timelineStartMs: z.ZodNumber;
    sourceInMs: z.ZodOptional<z.ZodNumber>;
    sourceOutMs: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    mediaId: string;
    timelineStartMs: number;
    trackType: "video" | "audio" | "overlay";
    sourceInMs?: number | undefined;
    sourceOutMs?: number | undefined;
}, {
    mediaId: string;
    timelineStartMs: number;
    trackType: "video" | "audio" | "overlay";
    sourceInMs?: number | undefined;
    sourceOutMs?: number | undefined;
}>;
export declare const TrimClipArgs: z.ZodObject<{
    clipId: z.ZodString;
    sourceInMs: z.ZodNumber;
    sourceOutMs: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    sourceInMs: number;
    sourceOutMs: number;
    clipId: string;
}, {
    sourceInMs: number;
    sourceOutMs: number;
    clipId: string;
}>;
export declare const SetSpeedArgs: z.ZodObject<{
    clipId: z.ZodString;
    speed: z.ZodNumber;
    reverse: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    speed: number;
    clipId: string;
    reverse?: boolean | undefined;
}, {
    speed: number;
    clipId: string;
    reverse?: boolean | undefined;
}>;
export declare const AddTransitionArgs: z.ZodObject<{
    clipId: z.ZodString;
    side: z.ZodEnum<["in", "out"]>;
    transitionId: z.ZodString;
    durationMs: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    durationMs: number;
    side: "in" | "out";
    transitionId: string;
    clipId: string;
}, {
    durationMs: number;
    side: "in" | "out";
    transitionId: string;
    clipId: string;
}>;
export declare const ApplyEffectArgs: z.ZodObject<{
    clipId: z.ZodString;
    effectId: z.ZodString;
    params: z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodNumber, z.ZodString, z.ZodBoolean]>>;
}, "strip", z.ZodTypeAny, {
    params: Record<string, string | number | boolean>;
    effectId: string;
    clipId: string;
}, {
    params: Record<string, string | number | boolean>;
    effectId: string;
    clipId: string;
}>;
export declare const AddTextArgs: z.ZodObject<{
    text: z.ZodString;
    timelineStartMs: z.ZodNumber;
    durationMs: z.ZodNumber;
    style: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    text: string;
    durationMs: number;
    timelineStartMs: number;
    style?: Record<string, unknown> | undefined;
}, {
    text: string;
    durationMs: number;
    timelineStartMs: number;
    style?: Record<string, unknown> | undefined;
}>;
export declare const GenerateVideoArgs: z.ZodObject<{
    prompt: z.ZodString;
    durationMs: z.ZodNumber;
    aspectRatio: z.ZodOptional<z.ZodString>;
    style: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    prompt: string;
    durationMs: number;
    style?: string | undefined;
    aspectRatio?: string | undefined;
}, {
    prompt: string;
    durationMs: number;
    style?: string | undefined;
    aspectRatio?: string | undefined;
}>;
export declare const GenerateImageArgs: z.ZodObject<{
    prompt: z.ZodString;
    aspectRatio: z.ZodOptional<z.ZodString>;
    style: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    prompt: string;
    style?: string | undefined;
    aspectRatio?: string | undefined;
}, {
    prompt: string;
    style?: string | undefined;
    aspectRatio?: string | undefined;
}>;
export declare function isGenerationTool(tool: AIToolName): boolean;
export declare function validatePlanAgainstConstraints(plan: EditPlan): string[];
