/**
 * Background removal pipeline (FFmpeg-native + optional external ML hook).
 *
 * Production reality:
 *  - Pure FFmpeg cannot run a modern ML matting model.
 *  - We therefore provide:
 *      1. High-quality chromakey + despill + edge refine (always available)
 *      2. An optional externalMatting callback for real ML services
 *         (RemBG, MODNet, local ONNX, cloud API, etc.)
 *
 * The compositor calls into this module so the rest of the system stays
 * honest about what is and is not available.
 */

import { spawn } from 'child_process';
import { tryExternalMatting } from './external-matting';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

export interface BgRemoveOptions {
  /** Input video/image path */
  inputPath: string;
  /** Output path (must be different from input) */
  outputPath: string;
  /** Key color for chromakey fallback (hex or 0xRRGGBB) */
  keyColor?: string;
  similarity?: number;
  blend?: number;
  /** Despill strength 0–1 */
  despill?: number;
  /** Edge feather in pixels */
  edgeFeather?: number;
  /** Optional external ML matting – receives input path, must write alpha-capable output */
  externalMatting?: (input: string, output: string) => Promise<void>;
  /** Try PHENOVA_MATTING_URL / CLI before chromakey (default true) */
  preferMl?: boolean;
  model?: string;
  ffmpegPath?: string;
  workDir?: string;
}

export interface BgRemoveResult {
  outputPath: string;
  method: 'chromakey' | 'chromakey_despill' | 'external_ml';
}

function normalizeColor(c: string): string {
  if (c.startsWith('#')) return '0x' + c.slice(1);
  return c;
}

/**
 * Run background removal. Prefer external ML when supplied; otherwise
 * use a refined chromakey pipeline.
 */
export async function removeBackground(opts: BgRemoveOptions): Promise<BgRemoveResult> {
  if (!fs.existsSync(opts.inputPath)) {
    throw new Error(`Background removal: input not found: ${opts.inputPath}`);
  }
  if (opts.inputPath === opts.outputPath) {
    throw new Error('Background removal: input and output paths must differ');
  }

  if (opts.externalMatting) {
    await opts.externalMatting(opts.inputPath, opts.outputPath);
    if (!fs.existsSync(opts.outputPath) || fs.statSync(opts.outputPath).size === 0) {
      throw new Error('External ML matting produced empty or missing output');
    }
    return { outputPath: opts.outputPath, method: 'external_ml' };
  }

  // Auto-discover env-configured ML matting (PHENOVA_MATTING_URL / CLI)
  if (opts.preferMl !== false) {
    try {
      const mlOut = await tryExternalMatting({
        inputPath: opts.inputPath,
        outputPath: opts.outputPath,
        model: opts.model,
      });
      if (mlOut) return { outputPath: mlOut, method: 'external_ml' };
    } catch (e) {
      // fall through to chromakey
      if (process.env.PHENOVA_MATTING_STRICT === '1') throw e;
    }
  }

  // Chromakey + despill + edge refine pipeline
  const color = normalizeColor(opts.keyColor ?? '0x00FF00');
  const similarity = Math.max(0.01, Math.min(1, opts.similarity ?? 0.25));
  const blend = Math.max(0, Math.min(1, opts.blend ?? 0.08));
  const despill = Math.max(0, Math.min(1, opts.despill ?? 0.4));
  const feather = Math.max(0, opts.edgeFeather ?? 1.5);

  // Filter graph:
  //  1. chromakey → alpha
  //  2. despill via colorchannelmixer / hue shift on green spill
  //  3. slight blur on alpha for soft edges
  const filters = [
    `chromakey=${color}:${similarity.toFixed(3)}:${blend.toFixed(3)}`,
    `format=yuva420p`,
    // simple despill: reduce green channel contribution on non-key areas
    `colorchannelmixer=gg=${(1 - despill * 0.3).toFixed(3)}:gb=${(-despill * 0.1).toFixed(3)}`,
  ];
  if (feather > 0) {
    filters.push(`gblur=sigma=${feather.toFixed(2)}:planes=a`);
  }

  const ffmpeg = opts.ffmpegPath || 'ffmpeg';
  const args = [
    '-y', '-i', opts.inputPath,
    '-filter_complex', filters.join(','),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
    '-c:a', 'copy',
    '-movflags', '+faststart',
    opts.outputPath,
  ];

  await runFfmpeg(ffmpeg, args);
  if (!fs.existsSync(opts.outputPath) || fs.statSync(opts.outputPath).size === 0) {
    throw new Error('Chromakey background removal produced empty output');
  }
  return { outputPath: opts.outputPath, method: 'chromakey_despill' };
}

function runFfmpeg(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr?.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg bg-remove failed (code ${code}): ${stderr.slice(-800)}`));
    });
    proc.on('error', reject);
  });
}
