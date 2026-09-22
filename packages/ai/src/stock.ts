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
  resolveDownload?(assetId: string): Promise<{ url: string; license: LicenseInfo }>;
}

/**
 * Registry of providers. Add real API keys via env when integrating.
 */
export class StockRegistry {
  private providers = new Map<string, StockProvider>();

  register(provider: StockProvider): void {
    this.providers.set(provider.id, provider);
  }

  list(): StockProvider[] {
    return [...this.providers.values()];
  }

  get(id: string): StockProvider | undefined {
    return this.providers.get(id);
  }

  async searchAll(query: StockSearchQuery): Promise<StockSearchResult[]> {
    const results: StockSearchResult[] = [];
    for (const p of this.providers.values()) {
      try {
        results.push(await p.search(query));
      } catch (err) {
        // Skip failed providers; do not block the UI
        console.warn(`Stock provider ${p.id} failed:`, err);
      }
    }
    return results;
  }
}

/**
 * Example provider shape (Pexels-compatible).
 * Wire real API key via PEXELS_API_KEY when ready.
 */
export class PexelsProvider implements StockProvider {
  id = 'pexels';
  name = 'Pexels';
  private apiKey: string;
  private base = 'https://api.pexels.com';

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('Pexels API key required');
    this.apiKey = apiKey;
  }

  async search(query: StockSearchQuery): Promise<StockSearchResult> {
    const type = query.type === 'image' ? 'search' : 'videos/search';
    const url = new URL(`${this.base}/v1/${type}`);
    url.searchParams.set('query', query.query);
    url.searchParams.set('per_page', String(query.perPage ?? 15));
    url.searchParams.set('page', String(query.page ?? 1));
    if (query.orientation) url.searchParams.set('orientation', query.orientation);

    const res = await fetch(url.toString(), {
      headers: { Authorization: this.apiKey },
    });
    if (!res.ok) {
      throw new Error(`Pexels ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as any;

    const license: LicenseInfo = {
      name: 'Pexels License',
      summary: 'Free for commercial and personal use. Attribution appreciated but not required.',
      commercialUse: true,
      attributionRequired: false,
      url: 'https://www.pexels.com/license/',
    };

    const assets: StockAsset[] = [];

    if (query.type === 'image' && data.photos) {
      for (const p of data.photos) {
        assets.push({
          id: String(p.id),
          provider: this.id,
          type: 'image',
          title: p.alt || `Photo ${p.id}`,
          thumbnailUrl: p.src?.medium,
          previewUrl: p.src?.large,
          downloadUrl: p.src?.original,
          width: p.width,
          height: p.height,
          license,
          tags: [],
        });
      }
    } else if (data.videos) {
      for (const v of data.videos) {
        const file = (v.video_files || []).sort(
          (a: any, b: any) => (b.width || 0) - (a.width || 0)
        )[0];
        assets.push({
          id: String(v.id),
          provider: this.id,
          type: 'video',
          title: `Video ${v.id}`,
          thumbnailUrl: v.image,
          previewUrl: file?.link,
          downloadUrl: file?.link,
          durationMs: (v.duration || 0) * 1000,
          width: v.width,
          height: v.height,
          license,
          tags: [],
        });
      }
    }

    return {
      assets,
      page: query.page ?? 1,
      total: data.total_results,
      provider: this.id,
    };
  }
}

/** Build a registry from environment keys when present */

/**
 * Pixabay provider – free licensed media.
 * Set PIXABAY_API_KEY when integrating.
 */
export class PixabayProvider implements StockProvider {
  id = 'pixabay';
  name = 'Pixabay';
  private apiKey: string;
  private base = 'https://pixabay.com/api';

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('Pixabay API key required');
    this.apiKey = apiKey;
  }

  async search(query: StockSearchQuery): Promise<StockSearchResult> {
    const isVideo = query.type !== 'image';
    const url = new URL(isVideo ? `${this.base}/videos/` : `${this.base}/`);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('q', query.query);
    url.searchParams.set('per_page', String(query.perPage ?? 12));
    url.searchParams.set('page', String(query.page ?? 1));
    if (query.orientation === 'portrait') url.searchParams.set('orientation', 'vertical');
    if (query.orientation === 'landscape') url.searchParams.set('orientation', 'horizontal');

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Pixabay ${res.status}`);
    const data = (await res.json()) as any;

    const license: LicenseInfo = {
      name: 'Pixabay License',
      summary: 'Free for commercial use. No attribution required.',
      commercialUse: true,
      attributionRequired: false,
      url: 'https://pixabay.com/service/license/',
    };

    const assets: StockAsset[] = [];
    for (const hit of data.hits || []) {
      if (isVideo) {
        const vids = hit.videos || {};
        const best = vids.medium || vids.small || vids.tiny;
        assets.push({
          id: String(hit.id),
          provider: this.id,
          type: 'video',
          title: hit.tags || `Video ${hit.id}`,
          thumbnailUrl: best?.thumbnail,
          previewUrl: best?.url,
          downloadUrl: best?.url,
          durationMs: (hit.duration || 0) * 1000,
          width: best?.width,
          height: best?.height,
          license,
          tags: (hit.tags || '').split(', '),
        });
      } else {
        assets.push({
          id: String(hit.id),
          provider: this.id,
          type: 'image',
          title: hit.tags || `Image ${hit.id}`,
          thumbnailUrl: hit.previewURL,
          previewUrl: hit.webformatURL,
          downloadUrl: hit.largeImageURL || hit.webformatURL,
          width: hit.imageWidth,
          height: hit.imageHeight,
          license,
          tags: (hit.tags || '').split(', '),
        });
      }
    }

    return {
      assets,
      page: query.page ?? 1,
      total: data.totalHits,
      provider: this.id,
    };
  }
}


/**
 * Unsplash provider – high quality stills (images only).
 * Set UNSPLASH_ACCESS_KEY when integrating.
 */
export class UnsplashProvider implements StockProvider {
  id = 'unsplash';
  name = 'Unsplash';
  private accessKey: string;
  private base = 'https://api.unsplash.com';

  constructor(accessKey: string) {
    if (!accessKey) throw new Error('Unsplash access key required');
    this.accessKey = accessKey;
  }

  async search(query: StockSearchQuery): Promise<StockSearchResult> {
    const url = new URL(`${this.base}/search/photos`);
    url.searchParams.set('query', query.query);
    url.searchParams.set('per_page', String(query.perPage ?? 12));
    url.searchParams.set('page', String(query.page ?? 1));
    if (query.orientation) url.searchParams.set('orientation', query.orientation);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Client-ID ${this.accessKey}` },
    });
    if (!res.ok) throw new Error(`Unsplash ${res.status}`);
    const data = (await res.json()) as any;

    const license: LicenseInfo = {
      name: 'Unsplash License',
      summary: 'Free to use under the Unsplash License. Attribution appreciated.',
      commercialUse: true,
      attributionRequired: false,
      url: 'https://unsplash.com/license',
    };

    const assets: StockAsset[] = (data.results || []).map((photo: any) => ({
      id: photo.id,
      provider: this.id,
      type: 'image' as const,
      title: photo.description || photo.alt_description || `Photo ${photo.id}`,
      thumbnailUrl: photo.urls?.thumb,
      previewUrl: photo.urls?.regular,
      downloadUrl: photo.urls?.full || photo.urls?.raw,
      width: photo.width,
      height: photo.height,
      license,
      tags: (photo.tags || []).map((t: any) => t.title).filter(Boolean),
    }));

    return {
      assets,
      page: query.page ?? 1,
      total: data.total,
      provider: this.id,
    };
  }
}

export function createStockRegistryFromEnv(): StockRegistry {
  const registry = new StockRegistry();
  const pexelsKey = process.env.PEXELS_API_KEY;
  if (pexelsKey) {
    registry.register(new PexelsProvider(pexelsKey));
  }
  const pixabayKey = process.env.PIXABAY_API_KEY;
  if (pixabayKey) {
    registry.register(new PixabayProvider(pixabayKey));
  }
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
  if (unsplashKey) {
    registry.register(new UnsplashProvider(unsplashKey));
  }
  return registry;
}
