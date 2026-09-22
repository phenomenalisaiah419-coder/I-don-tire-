/**
 * Legacy provider interface – direct-provider compatible
 *
 * There is no mock. You must supply a real direct-provider implementation
 * that talks to configured provider endpoint. Until you do, AI planning will throw.
 */
import { EditPlan, EditConstraints } from './protocol';
import { UUID } from '@phenova/core';
import { ModelRouter } from './orchestrator';
export interface DirectProviderClient {
    /**
     * Core planning call.
     * The configured provider handles model routing for vision + long-context + structured output.
     */
    planEdit(request: {
        systemPrompt: string;
        userIntent: string;
        constraints: EditConstraints;
        mediaSummaries: Array<{
            id: UUID;
            durationMs: number;
            scenes: number;
            hasFaces: boolean;
            qualityScore?: number;
            description?: string;
        }>;
        previousPlanJson?: string;
        correction?: string;
    }): Promise<EditPlan>;
    /**
     * Generation – only called when constraints.allowGeneration === true
     */
    generateVideo(params: {
        prompt: string;
        durationMs: number;
        aspectRatio?: string;
        style?: string;
    }): Promise<{
        jobId: string;
        status: string;
    }>;
    generateImage(params: {
        prompt: string;
        aspectRatio?: string;
        style?: string;
    }): Promise<{
        jobId: string;
        url?: string;
        status: string;
    }>;
    /**
     * Optional but recommended: deep understanding of a single clip
     */
    understandMedia?(params: {
        mediaId: UUID;
        pathOrUrl: string;
    }): Promise<{
        description: string;
        tags: string[];
        qualityScore: number;
    }>;
}
export declare class DirectModelRouter implements ModelRouter {
    private client;
    private systemPrompt;
    constructor(client: DirectProviderClient, systemPrompt: string);
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
    generateVideo(params: {
        prompt: string;
        durationMs: number;
        style?: string;
    }): Promise<{
        jobId: string;
        status: string;
    }>;
    generateImage(params: {
        prompt: string;
        aspect?: string;
    }): Promise<{
        jobId: string;
        url?: string;
        status: string;
    }>;
}
