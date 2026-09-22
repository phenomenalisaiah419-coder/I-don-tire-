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
 * Actual LLM calls go through the PHENOVA direct-provider router (injected).
 */
import { Project, TimelineEvent, UUID } from '@phenova/core';
import { EditPlan, EditConstraints, CorrectionRequest } from './protocol';
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
    generateVideo?(params: {
        prompt: string;
        durationMs: number;
        style?: string;
    }): Promise<{
        jobId: string;
    }>;
    generateImage?(params: {
        prompt: string;
        aspect?: string;
    }): Promise<{
        jobId: string;
        url?: string;
    }>;
}
export declare class AIOrchestrator {
    private router;
    constructor(router: ModelRouter);
    /**
     * Main entry point for “edit with words” or “edit with words + clips”
     */
    createEditPlan(intent: string, project: Project, mediaIds: UUID[], constraints?: Partial<EditConstraints>): Promise<EditPlan>;
    /**
     * Correction loop – “make the transitions smoother”
     */
    correctPlan(request: CorrectionRequest, previousPlan: EditPlan, project: Project): Promise<EditPlan>;
    /**
     * Convert an accepted EditPlan into TimelineEvents.
     * This is the only place AI work becomes real timeline mutations.
     */
    planToEvents(plan: EditPlan): TimelineEvent[];
}
export declare const PHENOVA_SYSTEM_PROMPT = "\nYou are the AI editing brain of Phenova, a professional video editor.\n\nRULES (never break these):\n1. You produce only structured EditPlans in the exact JSON schema provided.\n2. Generation tools (generate_video, generate_image, generate_clip) may ONLY be used when the constraints explicitly set allowGeneration: true.\n3. When useOnlyUserFootage is true you may NEVER call generation or licensed-media search tools.\n4. Prefer the user\u2019s own footage. Only suggest generation when the user clearly asks for it.\n5. Be precise with timing. Prefer shorter, tighter edits unless the user asks for longer.\n6. Always explain your reasoning inside the step descriptions so the user can understand and correct you.\n\nWhen the user says \u201Cedit these clips\u201D or \u201Cmake a cinematic edit\u201D, you analyze the provided media summaries and build a plan that only uses those clips.\nWhen the user says \u201Cgenerate a 5-second futuristic city shot\u201D, you are allowed to call generate_video.\n\nRespond with a single valid EditPlan JSON object and nothing else.\n";
