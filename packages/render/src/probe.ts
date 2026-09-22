/**
 * Media Probing & Validation (spec §8/§13)
 *
 * Real metadata via ffprobe: duration, dimensions, fps, codec, audio
 * presence, file size, bitrate. Also content validation by magic bytes so
 * we never trust filename extensions.
 */

import { execFile } from 'child_process';
import * as fs from 'fs';

export interface ProbeResult {
  path: string;
  sizeBytes: number;
  durationMs: number;
  width?: number;
  height?: number;
  fps?: number;
  codec?: string;
  audioCodec?: string;
  hasAudio: boolean;
  sampleRate?: number;
  channels?: number;
  bitrateKbps?: number;
  container?: string;
}

const MAGIC: Array<{ bytes: number[]; offset: number; mime: string; kind: 'video' | 'audio' | 'image' }> = [
  { bytes: [0x00, 0x00, 0x00], offset: 0, mime: 'video/mp4', kind: 'video' }, // refined by ftyp check below
  { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4, mime: 'video/mp4', kind: 'video' },
  { bytes: [0x1a, 0x45, 0xdf, 0xa3], offset: 0, mime: 'video/webm', kind: 'video' },
  { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, mime: 'video/avi', kind: 'video' },
  { bytes: [0xff, 0xd8, 0xff], offset: 0, mime: 'image/jpeg', kind: 'image' },
  { bytes: [0x89, 0x50, 0x4e, 0x47], offset: 0, mime: 'image/png', kind: 'image' },
  { bytes: [0x47, 0x49, 0x46, 0x38], offset: 0, mime: 'image/gif', kind: 'image' },
  { bytes: [0x49, 0x44, 0x33], offset: 0, mime: 'audio/mpeg', kind: 'audio' },
  { bytes: [0xff, 0xfb], offset: 0, mime: 'audio/mpeg', kind: 'audio' },
  { bytes: [0x4f, 0x67, 0x67, 0x53], offset: 0, mime: 'audio/ogg', kind: 'audio' },
  { bytes: [0x66, 0x4c, 0x61, 0x43], offset: 0, mime: 'audio/flac', kind: 'audio' },
];

/** Detect real content type from magic bytes – never trust extensions. */
export function detectContentType(filePath: string): { mime: string; kind: 'video' | 'audio' | 'image' } | null {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    // MP4/MOV/M4A family: 'ftyp' at offset 4
    if (buf.length >= 8 && buf.toString('ascii', 4, 8) === 'ftyp') {
      const brand = buf.toString('ascii', 8, 12);
      if (brand.startsWith('M4A') || brand.startsWith('M4B')) return { mime: 'audio/mp4', kind: 'audio' };
      return { mime: 'video/mp4', kind: 'video' };
    }
    for (const m of MAGIC) {
      if (m.offset === 4) continue; // handled above
      let ok = true;
      for (let i = 0; i < m.bytes.length; i++) {
        if (buf[m.offset + i] !== m.bytes[i]) { ok = false; break; }
      }
      if (ok) return { mime: m.mime, kind: m.kind };
    }
    // RIFF could be WAV (audio) or AVI (video)
    if (buf.toString('ascii', 0, 4) === 'RIFF') {
      const form = buf.toString('ascii', 8, 12);
      if (form === 'WAVE') return { mime: 'audio/wav', kind: 'audio' };
      if (form === 'AVI ') return { mime: 'video/avi', kind: 'video' };
    }
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

export function probe(filePath: string, ffprobePath = 'ffprobe'): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) return reject(new Error(`File not found: ${filePath}`));
    const detected = detectContentType(filePath);
    if (!detected) {
      return reject(new Error(`Unrecognized media content in ${filePath} (failed magic-byte validation)`));
    }
    const stat = fs.statSync(filePath);
    execFile(
      ffprobePath,
      [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        filePath,
      ],
      { maxBuffer: 16 * 1024 * 1024 },
      (err, stdout) => {
        if (err) return reject(new Error(`ffprobe failed for ${filePath}: ${err.message}`));
        try {
          const data = JSON.parse(stdout);
          const format = data.format ?? {};
          const streams: any[] = data.streams ?? [];
          const video = streams.find(s => s.codec_type === 'video');
          const audio = streams.find(s => s.codec_type === 'audio');

          let fps: number | undefined;
          if (video?.avg_frame_rate && video.avg_frame_rate !== '0/0') {
            const [n, d] = String(video.avg_frame_rate).split('/').map(Number);
            if (d) fps = n / d;
          }
          const durationMs = Math.round(Number(format.duration ?? video?.duration ?? audio?.duration ?? 0) * 1000);
          if (!durationMs || durationMs <= 0) {
            return reject(new Error(`Could not determine duration for ${filePath} – corrupt or unsupported media`));
          }
          resolve({
            path: filePath,
            sizeBytes: stat.size,
            durationMs,
            width: video?.width,
            height: video?.height,
            fps,
            codec: video?.codec_name,
            audioCodec: audio?.codec_name,
            hasAudio: !!audio,
            sampleRate: audio ? Number(audio.sample_rate) : undefined,
            channels: audio?.channels,
            bitrateKbps: format.bit_rate ? Math.round(Number(format.bit_rate) / 1000) : undefined,
            container: format.format_name,
          });
        } catch (e) {
          reject(new Error(`Failed to parse ffprobe output: ${(e as Error).message}`));
        }
      }
    );
  });
}

/** Enforce upload constraints (spec §13: content validation). */
export function validateUpload(filePath: string, maxBytes: number): { kind: 'video' | 'audio' | 'image'; mime: string } {
  const stat = fs.statSync(filePath);
  if (stat.size === 0) throw new Error('Empty file rejected');
  if (stat.size > maxBytes) {
    throw new Error(`File exceeds storage quota (${stat.size} > ${maxBytes} bytes)`);
  }
  const detected = detectContentType(filePath);
  if (!detected) {
    throw new Error('Unsupported or corrupt media: content does not match any supported media signature');
  }
  return detected;
}
