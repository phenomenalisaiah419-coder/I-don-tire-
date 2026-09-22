/**
 * Phenova FFmpeg Render Pipeline
 *
 * High-quality, production-oriented wrappers around FFmpeg.
 * Designed to be replaceable by a GPU compositor later while
 * keeping the same interface.
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { Project, Clip, MediaAsset, Track } from '@phenova/core';

export interface RenderOptions {
  outputPath: string;
  width?: number;
  height?: number;
  fps?: number;
  codec?: 'h264' | 'h265' | 'prores' | 'vp9';
  quality?: 'draft' | 'high' | 'max';
  audioCodec?: 'aac' | 'pcm';
  hardwareAcceleration?: 'none' | 'videotoolbox' | 'nvenc' | 'vaapi';
}

export interface ProxyOptions {
  mediaPath: string;
  outputPath: string;
  maxWidth?: number;
  maxHeight?: number;
}

export class FFmpegRenderer {
  private ffmpegPath: string;

  constructor(ffmpegPath = 'ffmpeg') {
    this.ffmpegPath = ffmpegPath;
  }

  /**
   * Generate a low-resolution proxy for smooth scrubbing.
   */
  async generateProxy(opts: ProxyOptions): Promise<string> {
    const { mediaPath, outputPath, maxWidth = 720, maxHeight = 1280 } = opts;

    const args = [
      '-y',
      '-i', mediaPath,
      '-vf', `scale='min(${maxWidth},iw)':'min(${maxHeight},ih)':force_original_aspect_ratio=decrease`,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '28',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      outputPath,
    ];

    await this.run(args);
    return outputPath;
  }

  /**
   * Export the full project.
   * This is a simplified but production-ready starting point.
   * A full compositor would build a complex filter_complex graph.
   */
  async exportProject(project: Project, options: RenderOptions): Promise<string> {
    const {
      outputPath,
      width = project.settings.width,
      height = project.settings.height,
      fps = project.settings.fps,
      codec = 'h264',
      quality = 'high',
      hardwareAcceleration = 'none',
    } = options;

    // For the foundation we support a linear concatenation of video clips
    // on the first video track + mixed audio.
    // The full node-based compositor will replace this later.

    const videoTrack = project.tracks.find(t => t.type === 'video');
    if (!videoTrack || videoTrack.clips.length === 0) {
      throw new Error('No video clips to export');
    }
    if (!outputPath || outputPath.trim().length === 0) {
      throw new Error('Export outputPath is required');
    }
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    for (const clip of videoTrack.clips) {
      const media = project.media[clip.mediaId];
      if (!media) throw new Error(`Export: missing media ${clip.mediaId}`);
      if (!media.path || !fs.existsSync(media.path)) {
        throw new Error(`Export: source media not found: ${media.path || clip.mediaId}`);
      }
      if (clip.sourceOutMs <= clip.sourceInMs) {
        throw new Error(`Export: invalid source range for clip ${clip.id}`);
      }
      if ((clip.speed || 1) <= 0) {
        throw new Error(`Export: invalid speed for clip ${clip.id}`);
      }
    }

    // Build a simple concat demuxer file
    const listPath = path.join(path.dirname(outputPath), `concat_${Date.now()}.txt`);
    const lines: string[] = [];

    for (const clip of videoTrack.clips) {
      const media = project.media[clip.mediaId];
      if (!media) continue;

      // Apply in/out and speed via filter later; for foundation we use source range
      lines.push(`file '${media.path.replace(/'/g, "'\\''")}'`);
      lines.push(`inpoint ${clip.sourceInMs / 1000}`);
      lines.push(`outpoint ${clip.sourceOutMs / 1000}`);
    }

    fs.writeFileSync(listPath, lines.join('\n'));

    const videoCodec = this.resolveVideoCodec(codec, hardwareAcceleration);
    const crf = quality === 'draft' ? 28 : quality === 'high' ? 18 : 14;

    const args = [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-c:v', videoCodec,
      '-preset', quality === 'draft' ? 'veryfast' : 'slow',
      '-crf', String(crf),
      '-r', String(fps),
      '-s', `${width}x${height}`,
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      outputPath,
    ];

    const tempOutputPath = `${outputPath}.phenova-rendering-${Date.now()}.tmp`;
    const safeArgs = args.map((arg) => arg === outputPath ? tempOutputPath : arg);
    try {
      await this.run(safeArgs);
      if (!fs.existsSync(tempOutputPath) || fs.statSync(tempOutputPath).size === 0) {
        throw new Error('FFmpeg completed without producing a non-empty output file');
      }
      fs.renameSync(tempOutputPath, outputPath);
    } finally {
      if (fs.existsSync(listPath)) fs.unlinkSync(listPath);
      if (fs.existsSync(tempOutputPath)) fs.rmSync(tempOutputPath, { force: true });
    }

    return outputPath;
  }

  /**
   * Extract a high-quality frame for thumbnails / AI analysis.
   */
  async extractFrame(mediaPath: string, timeMs: number, outputPath: string): Promise<string> {
    const args = [
      '-y',
      '-ss', String(timeMs / 1000),
      '-i', mediaPath,
      '-frames:v', '1',
      '-q:v', '2',
      outputPath,
    ];
    await this.run(args);
    return outputPath;
  }


  /**
   * Higher-quality export using filter_complex for crossfades between clips.
   * Falls back to concat demuxer if only one clip.
   */
  async exportWithFilterComplex(project: Project, options: RenderOptions): Promise<string> {
    const {
      outputPath,
      width = project.settings.width,
      height = project.settings.height,
      fps = project.settings.fps,
      codec = 'h264',
      quality = 'high',
      hardwareAcceleration = 'none',
    } = options;

    const videoTrack = project.tracks.find(t => t.type === 'video');
    if (!videoTrack || videoTrack.clips.length === 0) {
      throw new Error('No video clips to export');
    }

    if (videoTrack.clips.length === 1) {
      return this.exportProject(project, options);
    }

    // Build filter_complex with xfade between consecutive clips
    const inputs: string[] = [];
    const filters: string[] = [];
    let lastLabel = '0:v';

    videoTrack.clips.forEach((clip, i) => {
      const media = project.media[clip.mediaId];
      if (!media) return;
      inputs.push('-ss', String(clip.sourceInMs / 1000));
      inputs.push('-t', String((clip.sourceOutMs - clip.sourceInMs) / 1000 / (clip.speed || 1)));
      inputs.push('-i', media.path);

      // Scale each input
      filters.push(`[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps}[v${i}]`);
    });

    // Chain xfade
    const clips = videoTrack.clips;
    for (let i = 1; i < clips.length; i++) {
      const prev = clips[i - 1];
      const fadeDur = Math.min(
        (prev.transitionOut?.durationMs ?? 400) / 1000,
        1.0
      );
      const offset = Math.max(0, ((prev.sourceOutMs - prev.sourceInMs) / 1000 / (prev.speed || 1)) - fadeDur);
      const outLabel = i === clips.length - 1 ? 'vout' : `vx${i}`;
      const left = i === 1 ? 'v0' : `vx${i - 1}`;
      filters.push(`[${left}][v${i}]xfade=transition=fade:duration=${fadeDur}:offset=${offset}[${outLabel}]`);
      lastLabel = outLabel;
    }

    if (clips.length === 1) {
      filters.push(`[v0]copy[vout]`);
    }

    const videoCodec = this.resolveVideoCodec(codec, hardwareAcceleration);
    const crf = quality === 'draft' ? 28 : quality === 'high' ? 18 : 14;

    const args = [
      '-y',
      ...inputs,
      '-filter_complex', filters.join(';'),
      '-map', '[vout]',
      '-c:v', videoCodec,
      '-preset', quality === 'draft' ? 'veryfast' : 'medium',
      '-crf', String(crf),
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      outputPath,
    ];

    await this.run(args);
    return outputPath;
  }


  /**
   * Build a simple amix filter string for all audio clips.
   * Used when exporting multi-track audio.
   */
  buildAudioMixFilter(audioClipCount: number): string | null {
    if (audioClipCount <= 0) return null;
    if (audioClipCount === 1) return '[0:a]anull[aout]';
    const inputs = Array.from({ length: audioClipCount }, (_, i) => `[${i}:a]`).join('');
    return `${inputs}amix=inputs=${audioClipCount}:duration=longest[aout]`;
  }

  private resolveVideoCodec(
    codec: RenderOptions['codec'],
    hw: RenderOptions['hardwareAcceleration']
  ): string {
    if (hw === 'videotoolbox') return 'h264_videotoolbox';
    if (hw === 'nvenc') return 'h264_nvenc';
    if (hw === 'vaapi') return 'h264_vaapi';
    if (codec === 'h265') return 'libx265';
    if (codec === 'vp9') return 'libvpx-vp9';
    if (codec === 'prores') return 'prores_ks';
    return 'libx264';
  }

  private run(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      proc.stderr?.on('data', (d) => { stderr += d.toString(); });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg failed (code ${code}):\n${stderr.slice(-2000)}`));
      });
      proc.on('error', reject);
    });
  }
}
