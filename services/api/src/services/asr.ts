/**
 * ASR / auto-captions
 *
 * Priority:
 *  1. OpenAI-compatible transcription (PHENOVA_PROVIDER_BASE_URL + key) /v1/audio/transcriptions
 *  2. Local whisper CLI if `whisper` is on PATH
 *  3. Structured placeholder segments (never silent failure without response)
 */
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

export interface AsrRequest {
  mediaPath?: string;
  mediaId?: string;
  language?: string;
}

export interface CaptionSeg {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  style?: { fontSize?: number; color?: string };
}

export interface AsrResult {
  captions: CaptionSeg[];
  method: 'openai_compatible' | 'whisper_cli' | 'placeholder';
  language?: string;
  raw?: string;
}

function postMultipart(
  urlStr: string,
  apiKey: string,
  filePath: string,
  language?: string,
): Promise<{ text: string }> {
  return new Promise((resolve, reject) => {
    const boundary = '----PhenovaAsr' + Date.now();
    const fileBuf = fs.readFileSync(filePath);
    const filename = path.basename(filePath);
    const parts: Buffer[] = [];
    const push = (s: string | Buffer) => parts.push(typeof s === 'string' ? Buffer.from(s) : s);

    push(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`);
    push(fileBuf);
    push(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`);
    if (language) {
      push(`--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${language}\r\n`);
    }
    push(`--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\nverbose_json\r\n`);
    push(`--${boundary}--\r\n`);
    const body = Buffer.concat(parts);

    const u = new URL(urlStr);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
        timeout: 120_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          try {
            const j = JSON.parse(raw);
            resolve({ text: j.text || raw });
          } catch {
            resolve({ text: raw });
          }
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function segmentsFromText(text: string, durationMs = 30000): CaptionSeg[] {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!sentences.length) {
    return [
      {
        id: `cap_${Date.now()}`,
        text: text.slice(0, 80) || '…',
        startMs: 0,
        endMs: Math.min(3000, durationMs),
        style: { fontSize: 42, color: '#FFFFFF' },
      },
    ];
  }
  const slice = Math.floor(durationMs / sentences.length);
  return sentences.map((s, i) => ({
    id: `cap_${Date.now()}_${i}`,
    text: s,
    startMs: i * slice,
    endMs: Math.min(durationMs, (i + 1) * slice),
    style: { fontSize: 42, color: '#FFFFFF' },
  }));
}

export async function transcribe(req: AsrRequest): Promise<AsrResult> {
  const key = process.env.PHENOVA_PROVIDER_API_KEY || process.env.OPENAI_API_KEY;
  const base = (process.env.PHENOVA_PROVIDER_BASE_URL || 'https://api.openai.com').replace(/\/$/, '');
  const mediaPath = req.mediaPath;

  if (key && mediaPath && fs.existsSync(mediaPath)) {
    try {
      const url = `${base}/v1/audio/transcriptions`;
      const { text } = await postMultipart(url, key, mediaPath, req.language);
      if (text?.trim()) {
        return {
          captions: segmentsFromText(text.trim()),
          method: 'openai_compatible',
          language: req.language,
          raw: text,
        };
      }
    } catch (e) {
      // fall through
    }
  }

  // whisper CLI
  if (mediaPath && fs.existsSync(mediaPath)) {
    const out = await new Promise<string>((resolve) => {
      const proc = spawn('whisper', [mediaPath, '--output_format', 'txt', '--fp16', 'False'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      proc.stdout?.on('data', (d) => (stdout += d.toString()));
      proc.on('close', () => resolve(stdout));
      proc.on('error', () => resolve(''));
    });
    if (out.trim()) {
      return { captions: segmentsFromText(out.trim()), method: 'whisper_cli', language: req.language, raw: out };
    }
  }

  // Placeholder – honest structured result so UI can continue
  return {
    captions: [
      {
        id: `cap_ph_${Date.now()}`,
        text: '[Auto captions] Connect PHENOVA_PROVIDER_API_KEY or install whisper for live ASR',
        startMs: 0,
        endMs: 4000,
        style: { fontSize: 36, color: '#FFFFFF' },
      },
    ],
    method: 'placeholder',
    language: req.language,
  };
}
