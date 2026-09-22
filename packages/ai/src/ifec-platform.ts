/**
 * Direct Provider Client
 *
 * Talks to a configured direct provider endpoint
 * No mocks. Requires a valid API key.
 *
 * Usage:
 *   const client = new DirectProviderClient(process.env.PHENOVA_PROVIDER_API_KEY!);
 *   editor.setProviderClient(client);
 *
 *   // or
 *   const client = createDirectProviderClientFromEnv();
 */

import { EditPlan, EditConstraints, EditPlanSchema } from './protocol';
import { UUID } from '@phenova/core';
import { ModelRouter } from './orchestrator';
import type { DirectGenerationClient } from './generation';

/** Primary production endpoint */
const DEFAULT_BASE = process.env.PHENOVA_PROVIDER_BASE_URL || 'https://api.groq.com/openai/v1';

export interface DirectProviderOptions {
  /** Override direct provider base URL */
  baseUrl?: string;
  /** Request timeout in ms (default 120s) */
  timeoutMs?: number;
  /** Extra headers */
  headers?: Record<string, string>;
}

export class DirectProviderClient implements ModelRouter, DirectGenerationClient {
  private baseUrl: string;
  private apiKey: string;
  private timeoutMs: number;
  private extraHeaders: Record<string, string>;

  constructor(apiKey: string, options: DirectProviderOptions = {}) {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('PHENOVA provider API key is required');
    }
    this.apiKey = apiKey.trim();
    this.baseUrl = (options.baseUrl || DEFAULT_BASE).replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.extraHeaders = options.headers ?? {};
  }

  // -------------------------------------------------------------------------
  // Core planning
  // -------------------------------------------------------------------------

  async planEdit(request: {
    systemPrompt: string;
    userIntent: string;
    constraints: EditConstraints;
    mediaSummaries: Array<{ id: UUID; durationMs: number; scenes: number; hasFaces: boolean; qualityScore?: number; description?: string }>;
    previousPlanJson?: string;
    correction?: string;
  }): Promise<EditPlan> {
    return this.generateEditPlan({
      intent: request.userIntent,
      constraints: request.constraints,
      mediaSummaries: request.mediaSummaries,
      previousPlan: request.previousPlanJson ? JSON.parse(request.previousPlanJson) : undefined,
      correction: request.correction,
    });
  }

  async generateEditPlan(params: {
    intent: string;
    constraints: EditConstraints;
    mediaSummaries: Array<{
      id: UUID; durationMs: number; scenes: number; hasFaces: boolean;
      qualityScore?: number; description?: string;
    }>;
    previousPlan?: EditPlan;
    correction?: string;
  }): Promise<EditPlan> {
    const body = {
      intent: params.intent,
      constraints: params.constraints,
      mediaSummaries: params.mediaSummaries,
      previousPlan: params.previousPlan,
      correction: params.correction,
    };
    const raw = await this.post<any>('/chat/completions', {
      model: process.env.PHENOVA_PROVIDER_MODEL || (this.baseUrl.includes('openrouter.ai') ? (process.env.PHENOVA_OPENROUTER_MODEL || 'openrouter/free') : 'llama-3.3-70b-versatile'),
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: process.env.PHENOVA_SYSTEM_PROMPT || 'Return only a valid Phenova EditPlan JSON object.' },
        { role: 'user', content: JSON.stringify(body) },
      ],
    });
    const content = raw?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('Provider returned no structured EditPlan content');
    const parsed = EditPlanSchema.safeParse(JSON.parse(content));
    if (!parsed.success) throw new Error(`Provider returned invalid EditPlan: ${parsed.error.message}`);
    return parsed.data;
  }

  // -------------------------------------------------------------------------
  // Generation
  // -------------------------------------------------------------------------

  async generateVideo(params: {
    prompt: string;
    durationMs: number;
    aspectRatio?: string;
    style?: string;
  }): Promise<{ jobId: string; status: string }> {
    const body = {
      prompt: params.prompt,
      duration_ms: params.durationMs,
      aspect_ratio: params.aspectRatio,
      style: params.style,
    };

    const res = await this.post<any>(process.env.PHENOVA_VIDEO_GENERATION_PATH || '/video/generations', body);
    return { jobId: String(res.job_id || res.id || `video-${Date.now()}`), status: String(res.status || 'submitted') };
  }

  async generateImage(params: {
    prompt: string;
    aspectRatio?: string;
    style?: string;
  }): Promise<{ jobId: string; url?: string; status: string }> {
    const body = {
      prompt: params.prompt,
      aspect_ratio: params.aspectRatio,
      style: params.style,
    };

    const res = await this.post<any>(process.env.PHENOVA_IMAGE_GENERATION_PATH || '/images/generations', body);
    return { jobId: String(res.job_id || res.id || `image-${Date.now()}`), url: res.url || res.data?.[0]?.url, status: String(res.status || 'submitted') };
  }

  // -------------------------------------------------------------------------
  // Media understanding
  // -------------------------------------------------------------------------

  async understandMedia(params: {
    mediaId: UUID;
    pathOrUrl: string;
  }): Promise<{ description: string; tags: string[]; qualityScore: number }> {
    const body = {
      media_id: params.mediaId,
      path_or_url: params.pathOrUrl,
    };

    const res = await this.post<any>(process.env.PHENOVA_MEDIA_UNDERSTANDING_PATH || '/media/understand', body);
    return { description: String(res.description || ''), tags: Array.isArray(res.tags) ? res.tags : [], qualityScore: Number(res.quality_score ?? res.qualityScore ?? 0) };
  }

  // -------------------------------------------------------------------------
  // HTTP
  // -------------------------------------------------------------------------

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
          ...this.extraHeaders,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(
          `Provider ${path} failed (${response.status}): ${text.slice(0, 500)}`
        );
      }

      return (await response.json()) as T;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Provider request timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Factory that reads PHENOVA_PROVIDER_API_KEY from the environment.
 * Throws if the key is missing.
 */
export function createDirectProviderClientFromEnv(
  options?: DirectProviderOptions
): DirectProviderClient {
  const key = process.env.PHENOVA_PROVIDER_API_KEY;
  if (!key) {
    throw new Error(
      'PHENOVA_PROVIDER_API_KEY environment variable is required. Set it to your real PHENOVA provider key.'
    );
  }
  return new DirectProviderClient(key, options);
}


/** OpenRouter-compatible client factory.
 *
 * Uses the OpenAI-compatible chat-completions endpoint. The free router
 * (`openrouter/free`) is selected by default and never falls back to paid
 * models. Configure PHENOVA_OPENROUTER_MODEL explicitly to pin a model.
 */
export function createOpenRouterProviderClientFromEnv(
  options?: Omit<DirectProviderOptions, 'baseUrl'>
): DirectProviderClient {
  const key = process.env.PHENOVA_OPENROUTER_API_KEY;
  if (!key) {
    throw new Error(
      'PHENOVA_OPENROUTER_API_KEY environment variable is required.'
    );
  }
  return new DirectProviderClient(key, {
    ...options,
    baseUrl: 'https://openrouter.ai/api/v1',
    headers: {
      'HTTP-Referer': process.env.PHENOVA_OPENROUTER_REFERER || 'https://phenova.app',
      'X-Title': process.env.PHENOVA_OPENROUTER_TITLE || 'PHENOVA',
      ...(options?.headers ?? {}),
    },
  });
}

/**
 * Direct multi-provider router. Providers are attempted in order; transient
 * provider failures fall through to the next configured provider.
 * No direct provider server is required.
 */
export class DirectProviderFailover implements ModelRouter {
  constructor(private readonly providers: DirectProviderClient[]) {
    if (providers.length === 0) throw new Error('At least one direct provider is required');
  }

  async generateEditPlan(params: Parameters<ModelRouter['generateEditPlan']>[0]): Promise<EditPlan> {
    let lastError: unknown;
    for (const provider of this.providers) {
      try {
        return await provider.generateEditPlan(params);
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(`All direct PHENOVA providers failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
  }
}

/** Read a JSON provider list from PHENOVA_DIRECT_PROVIDERS_JSON. */
export function createDirectProviderFailoverFromEnv(): DirectProviderFailover {
  const raw = process.env.PHENOVA_DIRECT_PROVIDERS_JSON;
  if (!raw) return new DirectProviderFailover([createDirectProviderClientFromEnv()]);
  let entries: Array<{ apiKey: string; baseUrl: string; timeoutMs?: number }>;
  try {
    entries = JSON.parse(raw);
  } catch {
    throw new Error('PHENOVA_DIRECT_PROVIDERS_JSON must be valid JSON');
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('PHENOVA_DIRECT_PROVIDERS_JSON must contain at least one provider');
  }
  return new DirectProviderFailover(entries.map((entry) => new DirectProviderClient(entry.apiKey, {
    baseUrl: entry.baseUrl,
    timeoutMs: entry.timeoutMs,
  })));
}
