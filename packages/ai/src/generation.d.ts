/**
 * Generation surface – always opt-in.
 * Calls direct provider generation endpoints and returns job metadata
 * that the engine turns into MediaAssets when ready.
 */
import { DirectProviderClient } from './ifec';
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
export declare class GenerationService {
    private client;
    constructor(client: DirectProviderClient);
    generateVideo(params: {
        prompt: string;
        durationMs: number;
        aspectRatio?: string;
        style?: string;
    }): Promise<GenerationJob>;
    generateImage(params: {
        prompt: string;
        aspectRatio?: string;
        style?: string;
    }): Promise<GenerationJob>;
}
