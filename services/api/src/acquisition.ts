/**
 * Media Acquisition service (spec §6).
 *
 * - Supported/licensed providers ONLY (Pexels, Pixabay official APIs).
 * - No scraping of random websites.
 * - Search presents source + rights info; import downloads the asset,
 *   preserves provenance/license metadata, and registers it as normal
 *   editable project media.
 * - Unverified material is never labeled licensed.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { StorageService } from './storage';
import { DataStore } from './db';
import { ServerConfig } from './config';
import { ApiError } from './auth';

export interface RemoteMediaItem {
  provider: string;             // 'pexels' | 'pixabay'
  providerAssetId: string;
  type: 'video' | 'image';
  previewUrl: string;
  downloadUrl: string;
  width?: number;
  height?: number;
  durationMs?: number;
  /** Verbatim license text/source as provided by the provider. */
  license: {
    name: string;
    url: string;
    attribution: string;
  };
  sourcePageUrl: string;
}

interface Provider {
  id: string;
  search(query: string, type: 'video' | 'image', page: number, perPage: number): Promise<RemoteMediaItem[]>;
}

class PexelsProvider implements Provider {
  id = 'pexels';
  constructor(private apiKey: string) {}

  async search(query: string, type: 'video' | 'image', page: number, perPage: number): Promise<RemoteMediaItem[]> {
    const endpoint = type === 'video'
      ? `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`
      : `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`;
    const res = await fetch(endpoint, { headers: { Authorization: this.apiKey } });
    if (!res.ok) throw new ApiError(502, `Pexels API error (${res.status})`);
    const data: any = await res.json();

    if (type === 'video') {
      return (data.videos ?? []).map((v: any) => {
        const file = (v.video_files ?? [])
          .filter((f: any) => f.quality === 'hd' || f.quality === 'sd')
          .sort((a: any, b: any) => (b.width ?? 0) - (a.width ?? 0))[0] ?? (v.video_files ?? [])[0];
        return {
          provider: this.id,
          providerAssetId: String(v.id),
          type: 'video' as const,
          previewUrl: v.image,
          downloadUrl: file?.link,
          width: file?.width,
          height: file?.height,
          durationMs: v.duration ? v.duration * 1000 : undefined,
          license: {
            name: 'Pexels License',
            url: 'https://www.pexels.com/license/',
            attribution: `Video by ${v.user?.name ?? 'unknown'} on Pexels`,
          },
          sourcePageUrl: v.url,
        };
      }).filter((i: RemoteMediaItem) => !!i.downloadUrl);
    }
    return (data.photos ?? []).map((p: any) => ({
      provider: this.id,
      providerAssetId: String(p.id),
      type: 'image' as const,
      previewUrl: p.src?.medium,
      downloadUrl: p.src?.original,
      width: p.width,
      height: p.height,
      license: {
        name: 'Pexels License',
        url: 'https://www.pexels.com/license/',
        attribution: `Photo by ${p.photographer ?? 'unknown'} on Pexels`,
      },
      sourcePageUrl: p.url,
    }));
  }
}

class PixabayProvider implements Provider {
  id = 'pixabay';
  constructor(private apiKey: string) {}

  async search(query: string, type: 'video' | 'image', page: number, perPage: number): Promise<RemoteMediaItem[]> {
    const endpoint = type === 'video'
      ? `https://pixabay.com/api/videos/?key=${this.apiKey}&q=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`
      : `https://pixabay.com/api/?key=${this.apiKey}&q=${encodeURIComponent(query)}&image_type=photo&page=${page}&per_page=${perPage}`;
    const res = await fetch(endpoint);
    if (!res.ok) throw new ApiError(502, `Pixabay API error (${res.status})`);
    const data: any = await res.json();

    if (type === 'video') {
      return (data.hits ?? []).map((v: any) => {
        const file = v.videos?.large ?? v.videos?.medium ?? v.videos?.small;
        return {
          provider: this.id,
          providerAssetId: String(v.id),
          type: 'video' as const,
          previewUrl: file?.thumbnail,
          downloadUrl: file?.url,
          width: file?.width,
          height: file?.height,
          durationMs: v.duration ? v.duration * 1000 : undefined,
          license: {
            name: 'Pixabay Content License',
            url: 'https://pixabay.com/service/license-summary/',
            attribution: `Video by ${v.user ?? 'unknown'} on Pixabay`,
          },
          sourcePageUrl: v.pageURL,
        };
      }).filter((i: RemoteMediaItem) => !!i.downloadUrl);
    }
    return (data.hits ?? []).map((p: any) => ({
      provider: this.id,
      providerAssetId: String(p.id),
      type: 'image' as const,
      previewUrl: p.webformatURL,
      downloadUrl: p.largeImageURL,
      width: p.imageWidth,
      height: p.imageHeight,
      license: {
        name: 'Pixabay Content License',
        url: 'https://pixabay.com/service/license-summary/',
        attribution: `Image by ${p.user ?? 'unknown'} on Pixabay`,
      },
      sourcePageUrl: p.pageURL,
    }));
  }
}

export class AcquisitionService {
  private providers: Provider[] = [];

  constructor(
    private db: DataStore,
    private storage: StorageService,
    private config: ServerConfig,
  ) {
    if (config.pexelsApiKey) this.providers.push(new PexelsProvider(config.pexelsApiKey));
    if (config.pixabayApiKey) this.providers.push(new PixabayProvider(config.pixabayApiKey));
  }

  get availableProviders(): string[] {
    return this.providers.map(p => p.id);
  }

  async search(query: string, type: 'video' | 'image', page = 1, perPage = 12): Promise<{ providers: string[]; results: RemoteMediaItem[] }> {
    if (!query?.trim()) throw new ApiError(400, 'query required');
    if (this.providers.length === 0) {
      throw new ApiError(503, 'No licensed media providers configured (set PEXELS_API_KEY / PIXABAY_API_KEY)');
    }
    const settled = await Promise.allSettled(this.providers.map(p => p.search(query, type, page, perPage)));
    const results: RemoteMediaItem[] = [];
    const usedProviders: string[] = [];
    const errors: string[] = [];
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        results.push(...r.value);
        usedProviders.push(this.providers[i].id);
      } else {
        errors.push(`${this.providers[i].id}: ${(r.reason as Error).message}`);
      }
    });
    if (results.length === 0 && errors.length > 0) {
      throw new ApiError(502, `All providers failed: ${errors.join('; ')}`);
    }
    return { providers: usedProviders, results };
  }

  /**
   * Import a selected item: download from the provider CDN, validate
   * content, store under the user's quota, register provenance.
   */
  async importMedia(userId: string, item: RemoteMediaItem, plan: 'free' | 'premium', projectId?: string) {
    if (!item?.downloadUrl || !item.provider || !item.license?.url) {
      throw new ApiError(400, 'A provider item with downloadUrl and license info is required');
    }
    // Only allow downloads from known provider domains.
    const url = new URL(item.downloadUrl);
    const allowedHosts = ['pexels.com', 'videos.pexels.com', 'images.pexels.com', 'pixabay.com', 'cdn.pixabay.com', 'player.vimeo.com'];
    if (!allowedHosts.some(h => url.hostname === h || url.hostname.endsWith('.' + h))) {
      throw new ApiError(400, `Refusing to download from untrusted host ${url.hostname} (licensed providers only)`);
    }

    const tmp = path.join(os.tmpdir(), `phenova-acq-${uuidv4()}`);
    const res = await fetch(item.downloadUrl);
    if (!res.ok || !res.body) throw new ApiError(502, `Provider download failed (${res.status})`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(tmp, buf);

    try {
      const filename = `${item.provider}-${item.providerAssetId}`;
      const stored = await this.storage.storeLocalFile(userId, tmp, filename, plan);
      const registered = await this.storage.registerMediaFromFile({
        userId,
        projectId,
        absolutePath: stored.object.absolutePath,
        kind: 'licensed',
        type: item.type,
        sourceJson: {
          kind: 'licensed',
          provider: item.provider,
          assetId: item.providerAssetId,
          license: item.license.name,
          licenseUrl: item.license.url,
          attribution: item.license.attribution,
          sourcePageUrl: item.sourcePageUrl,
          acquiredAt: new Date().toISOString(),
        },
      });
      return { mediaId: registered.id, path: stored.object.absolutePath, probe: registered.probe, provenance: item };
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  }
}
