/**
 * External ML matting adapter.
 *
 * PHENOVA does not ship neural network weights. Instead it supports:
 *  1. HTTP matting services (rembg-style, custom GPU workers)
 *  2. Local CLI tools (rembg, transparent-background) when installed
 *  3. Fallback to chromakey in background-removal.ts
 *
 * Configure via env:
 *   PHENOVA_MATTING_URL=http://127.0.0.1:7001/matte
 *   PHENOVA_MATTING_CLI=rembg
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

export interface MattingRequest {
  inputPath: string;
  outputPath: string;
  /** Optional model hint for the remote service */
  model?: string;
  timeoutMs?: number;
}

export interface MattingProvider {
  id: string;
  isAvailable(): Promise<boolean>;
  matte(req: MattingRequest): Promise<string>;
}

/** HTTP POST multipart or raw file to a matting endpoint. */
export class HttpMattingProvider implements MattingProvider {
  id = 'http-matting';
  constructor(
    private baseUrl: string,
    private opts: { apiKey?: string; model?: string } = {}
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2000);
      const res = await fetch(this.baseUrl.replace(/\/matte$/, '/health'), {
        signal: ctrl.signal,
      }).catch(() => fetch(this.baseUrl, { method: 'OPTIONS', signal: ctrl.signal }));
      clearTimeout(t);
      return res.ok || res.status === 404 || res.status === 405;
    } catch {
      return false;
    }
  }

  async matte(req: MattingRequest): Promise<string> {
    const buf = fs.readFileSync(req.inputPath);
    const form = new FormData();
    form.append('file', new Blob([buf]), path.basename(req.inputPath));
    if (req.model || this.opts.model) {
      form.append('model', req.model || this.opts.model || 'u2net');
    }

    const headers: Record<string, string> = {};
    if (this.opts.apiKey) headers['Authorization'] = `Bearer ${this.opts.apiKey}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), req.timeoutMs ?? 120_000);
    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        body: form,
        headers,
        signal: ctrl.signal,
      });
      if (!res.ok) {
        throw new Error(`Matting service HTTP ${res.status}: ${await res.text().catch(() => '')}`);
      }
      const ab = await res.arrayBuffer();
      fs.writeFileSync(req.outputPath, Buffer.from(ab));
      if (!fs.existsSync(req.outputPath) || fs.statSync(req.outputPath).size === 0) {
        throw new Error('Matting service returned empty body');
      }
      return req.outputPath;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Local CLI wrapper, e.g. `rembg i input.png output.png`. */
export class CliMattingProvider implements MattingProvider {
  id = 'cli-matting';
  constructor(private command = 'rembg', private subcommand = 'i') {}

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const p = spawn(this.command, ['--help'], { stdio: 'ignore' });
      p.on('close', (code) => resolve(code === 0 || code === 1));
      p.on('error', () => resolve(false));
    });
  }

  async matte(req: MattingRequest): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [this.subcommand, req.inputPath, req.outputPath];
      const p = spawn(this.command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let err = '';
      p.stderr?.on('data', (d) => { err += d.toString(); });
      p.on('close', (code) => {
        if (code === 0 && fs.existsSync(req.outputPath) && fs.statSync(req.outputPath).size > 0) {
          resolve(req.outputPath);
        } else {
          reject(new Error(`CLI matting failed (${code}): ${err.slice(-500)}`));
        }
      });
      p.on('error', reject);
    });
  }
}

/** Resolve best available provider from environment. */
export function createMattingProviderFromEnv(): MattingProvider | null {
  const url = process.env.PHENOVA_MATTING_URL;
  if (url) {
    return new HttpMattingProvider(url, {
      apiKey: process.env.PHENOVA_MATTING_API_KEY,
      model: process.env.PHENOVA_MATTING_MODEL,
    });
  }
  const cli = process.env.PHENOVA_MATTING_CLI;
  if (cli) {
    return new CliMattingProvider(cli);
  }
  return null;
}

/**
 * High-level: try external ML, return null if none configured/available
 * so callers can fall back to chromakey.
 */
export async function tryExternalMatting(req: MattingRequest): Promise<string | null> {
  const provider = createMattingProviderFromEnv();
  if (!provider) return null;
  const ok = await provider.isAvailable();
  if (!ok) return null;
  return provider.matte(req);
}
