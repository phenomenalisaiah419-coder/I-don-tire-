/**
 * Generation surface – always opt-in.
 * Calls configured direct generation endpoints and returns job metadata
 * that the engine turns into MediaAssets when ready.
 */

export interface DirectGenerationClient {
  generateVideo(params: { prompt: string; durationMs: number; aspectRatio?: string; style?: string }): Promise<{ jobId: string; status: string }>;
  generateImage(params: { prompt: string; aspectRatio?: string; style?: string }): Promise<{ jobId: string; url?: string; status: string }>;
}
import { v4 as uuidv4 } from 'uuid';

export interface GenerationJob {
  jobId: string;
  kind: 'video' | 'image' | 'clip';
  prompt: string;
  status: string;
  url?: string;
  /** When the asset is ready, this is the MediaAsset-shaped payload */
  media?: {
    id: string;
    source: {
      kind: 'generated';
      model: string;
      prompt: string;
      jobId: string;
    };
    type: 'video' | 'image';
    durationMs: number;
    path: string;
    width?: number;
    height?: number;
  };
}

export class GenerationService {
  constructor(private client: DirectGenerationClient) {}

  async generateVideo(params: {
    prompt: string;
    durationMs: number;
    aspectRatio?: string;
    style?: string;
  }): Promise<GenerationJob> {
    const res = await this.client.generateVideo(params);
    return {
      jobId: res.jobId,
      kind: 'video',
      prompt: params.prompt,
      status: res.status,
    };
  }

  async generateImage(params: {
    prompt: string;
    aspectRatio?: string;
    style?: string;
  }): Promise<GenerationJob> {
    const res = await this.client.generateImage(params);
    const media = res.url
      ? {
          id: uuidv4(),
          source: {
            kind: 'generated' as const,
            model: process.env.PHENOVA_PROVIDER_MODEL || 'direct-provider',
            prompt: params.prompt,
            jobId: res.jobId,
          },
          type: 'image' as const,
          durationMs: 3000, // stills treated as short holds on timeline
          path: res.url,
        }
      : undefined;

    return {
      jobId: res.jobId,
      kind: 'image',
      prompt: params.prompt,
      status: res.status,
      url: res.url,
      media,
    };
  }
}
