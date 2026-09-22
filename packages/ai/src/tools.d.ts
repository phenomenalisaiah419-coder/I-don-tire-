/**
 * Phenova Tool Executor
 *
 * Converts validated AI tool calls into concrete TimelineEvents.
 * This is the bridge between the AI brain and the edit engine.
 *
 * After direct provider is plugged in, the ModelRouter produces EditPlans.
 * This module turns those plans into real timeline mutations.
 */
import { TimelineEvent, UUID, Milliseconds } from '@phenova/core';
import { EditPlan } from './protocol';
export declare const BUILTIN_TRANSITIONS: Record<string, {
    name: string;
    defaultDurationMs: number;
}>;
export declare const BUILTIN_EFFECTS: Record<string, {
    name: string;
    category: string;
    defaultParams: Record<string, number | string | boolean>;
}>;
export interface ToolContext {
    /** Current project tracks so we can auto-select a track if needed */
    videoTrackIds: UUID[];
    audioTrackIds: UUID[];
    overlayTrackIds: UUID[];
    /** Optional: media durations for smart defaults */
    mediaDurations: Record<UUID, Milliseconds>;
}
export declare class ToolExecutor {
    private ctx;
    constructor(ctx: ToolContext);
    /**
     * Turn an entire EditPlan into a list of TimelineEvents.
     * Generation tools are deliberately left as markers – the real
     * generation happens asynchronously via the direct provider / generation service.
     */
    executePlan(plan: EditPlan): TimelineEvent[];
    private executeTool;
    private placeClip;
    private trimClip;
    private setSpeed;
    private addTransition;
    private applyEffect;
    private addText;
    private setVolume;
    private addMarker;
    private addCaption;
}
