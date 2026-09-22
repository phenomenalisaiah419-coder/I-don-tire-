/**
 * Licensed / stock media connectors – rights-aware only.
 *
 * Phenova never scrapes random websites. Every provider must
 * declare license terms and return clear usage rights.
 */
export interface LicenseInfo {
    /** e.g. "Pexels License", "Storyblocks Subscription", "CC0" */
    name: string;
    /** Human-readable summary */
    summary: string;
    commercialUse: boolean;
    attributionRequired: boolean;
    url?: string;
}
export interface StockAsset {
    id: string;
    provider: string;
    type: 'video' | 'image' | 'audio';
    title: string;
    thumbnailUrl?: string;
    previewUrl?: string;
    downloadUrl: string;
    durationMs?: number;
    width?: number;
    height?: number;
    license: LicenseInfo;
    tags: string[];
}
export interface StockSearchQuery {
    query: string;
    type?: 'video' | 'image' | 'audio' | 'any';
    orientation?: 'portrait' | 'landscape' | 'square';
    minDurationMs?: number;
    maxDurationMs?: number;
    page?: number;
    perPage?: number;
}
export interface StockSearchResult {
    assets: StockAsset[];
    page: number;
    total?: number;
    provider: string;
}
export interface StockProvider {
    id: string;
    name: string;
    /** Search licensed catalog */
    search(query: StockSearchQuery): Promise<StockSearchResult>;
    /** Resolve a download URL / signed link when the user accepts the asset */
    resolveDownload?(assetId: string): Promise<{
        url: string;
        license: LicenseInfo;
    }>;
}
/**
 * Registry of providers. Add real API keys via env when integrating.
 */
export declare class StockRegistry {
    private providers;
    register(provider: StockProvider): void;
    list(): StockProvider[];
    get(id: string): StockProvider | undefined;
    searchAll(query: StockSearchQuery): Promise<StockSearchResult[]>;
}
/**
 * Example provider shape (Pexels-compatible).
 * Wire real API key via PEXELS_API_KEY when ready.
 */
export declare class PexelsProvider implements StockProvider {
    id: string;
    name: string;
    private apiKey;
    private base;
    constructor(apiKey: string);
    search(query: StockSearchQuery): Promise<StockSearchResult>;
}
/** Build a registry from environment keys when present */
/**
 * Pixabay provider – free licensed media.
 * Set PIXABAY_API_KEY when integrating.
 */
export declare class PixabayProvider implements StockProvider {
    id: string;
    name: string;
    private apiKey;
    private base;
    constructor(apiKey: string);
    search(query: StockSearchQuery): Promise<StockSearchResult>;
}
/**
 * Unsplash provider – high quality stills (images only).
 * Set UNSPLASH_ACCESS_KEY when integrating.
 */
export declare class UnsplashProvider implements StockProvider {
    id: string;
    name: string;
    private accessKey;
    private base;
    constructor(accessKey: string);
    search(query: StockSearchQuery): Promise<StockSearchResult>;
}
export declare function createStockRegistryFromEnv(): StockRegistry;
