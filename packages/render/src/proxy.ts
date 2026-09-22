/**
 * Phenova Proxy Manager
 *
 * Generates and caches low-resolution proxies, thumbnails, and filmstrips
 * for smooth timeline scrubbing and preview (CapCut-style).
 *
 * Design goals:
 *  - Idempotent: existing artifacts are reused
 *  - Bounded concurrency so mobile/server CPUs are not thrashed
 *  - Filmstrip frames for timeline thumbnails while scrubbing
 *  - Scrub-frame extraction at arbitrary times from proxy (cheap)
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { FFmpegRenderer } from './ffmpeg';

export interface ProxyConfig {
  cacheDir: string;
  maxWidth?: number;
  maxHeight?: number;
  thumbWidth?: number;
  /** Frames per filmstrip strip (default 10) */
  filmstripCount?: number;
  /** Max concurrent proxy jobs (default 2) */
  concurrency?: number;
  ffmpegPath?: string;
}

export interface ProxyResult {
  mediaPath: string;
  proxyPath: string;
  thumbnailPath: string;
  filmstripPath?: string;
  alreadyExisted: boolean;
}

export interface FilmstripResult {
  mediaId: string;
  frames: Array<{ timeMs: number; path: string }>;
  stripPath?: string;
}

export interface ProxyProgress {
  mediaId: string;
  phase: 'proxy' | 'thumb' | 'filmstrip' | 'done';
  percent: number;
}

type ProgressCb = (p: ProxyProgress) => void;

export class ProxyManager {
  private renderer: FFmpegRenderer;
  private config: Required<ProxyConfig>;
  private running: number = 0;
  private waiters: Array<() => void> = [];

  constructor(config: ProxyConfig) {
    const ffmpegPath = config.ffmpegPath ?? 'ffmpeg';
    this.renderer = new FFmpegRenderer(ffmpegPath);
    this.config = {
      cacheDir: config.cacheDir,
      maxWidth: config.maxWidth ?? 720,
      maxHeight: config.maxHeight ?? 1280,
      thumbWidth: config.thumbWidth ?? 320,
      filmstripCount: config.filmstripCount ?? 10,
      concurrency: config.concurrency ?? 2,
      ffmpegPath,
    };
    if (!fs.existsSync(this.config.cacheDir)) {
      fs.mkdirSync(this.config.cacheDir, { recursive: true });
    }
  }

  private async withSlot<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running >= this.config.concurrency) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      const next = this.waiters.shift();
      if (next) next();
    }
  }

  private runFfmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.config.ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      proc.stderr?.on('data', (d) => { stderr += d.toString(); });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg proxy failed (${code}): ${stderr.slice(-600)}`));
      });
      proc.on('error', reject);
    });
  }

  /**
   * Ensure proxy + thumbnail (+ optional filmstrip) exist for media.
   */
  async ensureProxy(
    mediaPath: string,
    mediaId: string,
    opts: { filmstrip?: boolean; onProgress?: ProgressCb } = {}
  ): Promise<ProxyResult> {
    return this.withSlot(async () => {
      const proxyPath = path.join(this.config.cacheDir, `${mediaId}_proxy.mp4`);
      const thumbnailPath = path.join(this.config.cacheDir, `${mediaId}_thumb.jpg`);
      const filmstripPath = path.join(this.config.cacheDir, `${mediaId}_strip.jpg`);

      const proxyExists = fs.existsSync(proxyPath) && fs.statSync(proxyPath).size > 0;
      const thumbExists = fs.existsSync(thumbnailPath) && fs.statSync(thumbnailPath).size > 0;
      const stripExists = fs.existsSync(filmstripPath) && fs.statSync(filmstripPath).size > 0;

      if (!proxyExists) {
        opts.onProgress?.({ mediaId, phase: 'proxy', percent: 10 });
        await this.renderer.generateProxy({
          mediaPath,
          outputPath: proxyPath,
          maxWidth: this.config.maxWidth,
          maxHeight: this.config.maxHeight,
        });
        opts.onProgress?.({ mediaId, phase: 'proxy', percent: 55 });
      }

      if (!thumbExists) {
        opts.onProgress?.({ mediaId, phase: 'thumb', percent: 60 });
        // Prefer proxy as source for speed
        const src = fs.existsSync(proxyPath) ? proxyPath : mediaPath;
        await this.renderer.extractFrame(src, 500, thumbnailPath);
        opts.onProgress?.({ mediaId, phase: 'thumb', percent: 75 });
      }

      if (opts.filmstrip && !stripExists) {
        opts.onProgress?.({ mediaId, phase: 'filmstrip', percent: 80 });
        await this.buildFilmstripImage(
          fs.existsSync(proxyPath) ? proxyPath : mediaPath,
          mediaId,
          filmstripPath
        );
      }

      opts.onProgress?.({ mediaId, phase: 'done', percent: 100 });
      return {
        mediaPath,
        proxyPath,
        thumbnailPath,
        filmstripPath: opts.filmstrip || stripExists ? filmstripPath : undefined,
        alreadyExisted: proxyExists && thumbExists && (!opts.filmstrip || stripExists),
      };
    });
  }

  async ensureProxies(
    items: Array<{ mediaPath: string; mediaId: string }>,
    opts: { filmstrip?: boolean; onProgress?: ProgressCb } = {}
  ): Promise<ProxyResult[]> {
    const results: ProxyResult[] = [];
    // Parallel within concurrency limit via ensureProxy's slot
    await Promise.all(
      items.map(async (item) => {
        const r = await this.ensureProxy(item.mediaPath, item.mediaId, opts);
        results.push(r);
      })
    );
    return results;
  }

  /**
   * Extract individual filmstrip frames (for timeline UI).
   */
  async generateFilmstrip(
    mediaPath: string,
    mediaId: string,
    durationMs: number
  ): Promise<FilmstripResult> {
    const dir = path.join(this.config.cacheDir, `${mediaId}_frames`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const count = this.config.filmstripCount;
    const frames: Array<{ timeMs: number; path: string }> = [];
    const src = fs.existsSync(path.join(this.config.cacheDir, `${mediaId}_proxy.mp4`))
      ? path.join(this.config.cacheDir, `${mediaId}_proxy.mp4`)
      : mediaPath;

    for (let i = 0; i < count; i++) {
      const timeMs = Math.floor((durationMs * (i + 0.5)) / count);
      const out = path.join(dir, `f${String(i).padStart(3, '0')}.jpg`);
      if (!fs.existsSync(out) || fs.statSync(out).size === 0) {
        await this.renderer.extractFrame(src, timeMs, out);
      }
      frames.push({ timeMs, path: out });
    }
    return { mediaId, frames };
  }

  /**
   * Single horizontal contact sheet (filmstrip image) for a clip.
   */
  private async buildFilmstripImage(
    mediaPath: string,
    mediaId: string,
    outputPath: string
  ): Promise<void> {
    const n = this.config.filmstripCount;
    const tw = this.config.thumbWidth;
    // fps trick: select n evenly spaced frames and tile horizontally
    // scale each to thumbWidth, then hstack
    const args = [
      '-y',
      '-i', mediaPath,
      '-vf',
      `fps=1/${Math.max(1, Math.floor(10 / n))},scale=${tw}:-1,tile=${n}x1`,
      '-frames:v', '1',
      '-q:v', '5',
      outputPath,
    ];
    try {
      await this.runFfmpeg(args);
    } catch {
      // Fallback: extract first frame only as strip
      await this.renderer.extractFrame(mediaPath, 0, outputPath);
    }
  }

  /**
   * Cheap scrub frame from proxy at an arbitrary time (for playhead hover).
   */
  async scrubFrame(
    mediaId: string,
    timeMs: number,
    outputPath?: string
  ): Promise<string> {
    const proxyPath = path.join(this.config.cacheDir, `${mediaId}_proxy.mp4`);
    if (!fs.existsSync(proxyPath)) {
      throw new Error(`No proxy for ${mediaId} – call ensureProxy first`);
    }
    const out =
      outputPath ||
      path.join(this.config.cacheDir, `${mediaId}_scrub_${Math.round(timeMs)}.jpg`);
    // Reuse if freshly generated for same ms bucket (100ms)
    const bucket = Math.round(timeMs / 100) * 100;
    const bucketPath = path.join(this.config.cacheDir, `${mediaId}_scrub_${bucket}.jpg`);
    if (fs.existsSync(bucketPath) && fs.statSync(bucketPath).size > 0) {
      return bucketPath;
    }
    await this.renderer.extractFrame(proxyPath, timeMs, bucketPath);
    return bucketPath;
  }

  /** Clear cached artifacts for one media id. */
  clearMedia(mediaId: string): void {
    const patterns = [
      `${mediaId}_proxy.mp4`,
      `${mediaId}_thumb.jpg`,
      `${mediaId}_strip.jpg`,
    ];
    for (const p of patterns) {
      const full = path.join(this.config.cacheDir, p);
      if (fs.existsSync(full)) fs.unlinkSync(full);
    }
    // scrub frames
    for (const f of fs.readdirSync(this.config.cacheDir)) {
      if (f.startsWith(`${mediaId}_scrub_`)) {
        fs.unlinkSync(path.join(this.config.cacheDir, f));
      }
    }
  }
}
