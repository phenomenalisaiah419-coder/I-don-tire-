/**
 * Direct Provider Integration – REAL ONLY
 *
 * There is no mock. You must supply a real DirectProviderClient implementation
 * that talks to your direct provider. Until you do, AI planning will throw.
 */

import { EditPlan, EditConstraints } from './protocol';
import { UUID } from '@phenova/core';
import { ModelRouter } from './orchestrator';

// ---------------------------------------------------------------------------
// Real direct provider Client Interface
// Implement this against your live direct provider API. Nothing else is provided.
// ---------------------------------------------------------------------------

export interface DirectProviderClient {
  /**
   * Core planning call.
   * direct providers route to the best available models for vision + long-context + structured output.
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
  }): Promise<{ jobId: string; status: string }>;

  generateImage(params: {
    prompt: string;
    aspectRatio?: string;
    style?: string;
  }): Promise<{ jobId: string; url?: string; status: string }>;

  /**
   * Optional but recommended: deep understanding of a single clip
   */
  understandMedia?(params: {
    mediaId: UUID;
    pathOrUrl: string;
  }): Promise<{ description: string; tags: string[]; qualityScore: number }>;
}

// ---------------------------------------------------------------------------
// Adapter – turns a real DirectProviderClient into the ModelRouter the orchestrator expects
// ---------------------------------------------------------------------------

export class DirectProviderModelRouter implements ModelRouter {
  constructor(
    private client: DirectProviderClient,
    private systemPrompt: string
  ) {}

  async generateEditPlan(params: {
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
  }): Promise<EditPlan> {
    return this.client.planEdit({
      systemPrompt: this.systemPrompt,
      userIntent: params.intent,
      constraints: params.constraints,
      mediaSummaries: params.mediaSummaries,
      previousPlanJson: params.previousPlan
        ? JSON.stringify(params.previousPlan)
        : undefined,
      correction: params.correction,
    });
  }

  async generateVideo(params: {
    prompt: string;
    durationMs: number;
    style?: string;
  }) {
    return this.client.generateVideo(params);
  }

  async generateImage(params: {
    prompt: string;
    aspect?: string;
  }) {
    return this.client.generateImage({
      prompt: params.prompt,
      aspectRatio: params.aspect,
    });
  }
}
