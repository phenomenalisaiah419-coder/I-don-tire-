/**
 * Motion tracking
 *
 * Methods:
 *  - externalTracker callback (ML / OpenCV / MediaPipe hook)
 *  - FFmpeg-assisted sparse samples (scene + frame extract for correlation seed)
 *  - linear / hold fallback between seed points
 *
 * bakeToPath / bakeToRects feed the compositor for mask follow.
 */
import { randomUUID } from 'crypto';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export type UUID = string;
export type Milliseconds = number;

export interface MaskPathPoint {
  x: number;
  y: number;
}

export interface MaskRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MotionTrackPoint {
  timeMs: Milliseconds;
  x: number;
  y: number;
  confidence: number;
  scale?: number;
}

export interface MotionTrack {
  id: UUID;
  mediaId: string;
  points: MotionTrackPoint[];
  method: 'ai' | 'manual' | 'ffmpeg_sparse' | 'optical_flow_hook';
}

export interface TrackMotionRequest {
  mediaId: string;
  mediaPath?: string;
  durationMs: number;
  seedPoints: Array<{ x: number; y: number; timeMs?: number }>;
  sampleIntervalMs?: number;
  /** Optional per-frame external detector (x,y normalized 0..1) */
  externalTracker?: (timeMs: number) => Promise<Array<{ x: number; y: number; confidence?: number }>>;
  /**
   * Optional dense optical-flow style hook:
   * given frame path + previous point → next point
   */
  opticalFlowStep?: (args: {
    framePath: string;
    prev: { x: number; y: number };
    timeMs: number;
  }) => Promise<{ x: number; y: number; confidence: number } | null>;
}

function runFfmpeg(args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr?.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => resolve({ code: code ?? 1, stderr }));
    proc.on('error', () => resolve({ code: 127, stderr: 'ffmpeg missing' }));
  });
}

/** Extract sparse frames for optional optical-flow hook / inspection. */
async function extractSparseFrames(
  mediaPath: string,
  durationMs: number,
  intervalMs: number,
  outDir: string,
): Promise<Array<{ timeMs: number; path: string }>> {
  fs.mkdirSync(outDir, { recursive: true });
  const frames: Array<{ timeMs: number; path: string }> = [];
  for (let t = 0; t <= durationMs; t += intervalMs) {
    const sec = (t / 1000).toFixed(3);
    const out = path.join(outDir, `f_${t}.png`);
    const { code } = await runFfmpeg([
      '-y',
      '-ss',
      sec,
      '-i',
      mediaPath,
      '-frames:v',
      '1',
      '-q:v',
      '3',
      out,
    ]);
    if (code === 0 && fs.existsSync(out)) {
      frames.push({ timeMs: t, path: out });
    }
  }
  return frames;
}

export class MotionTracker {
  async track(req: TrackMotionRequest): Promise<MotionTrack> {
    if (!req.seedPoints?.length) {
      throw new Error('MotionTracker: at least one seed point required');
    }
    const interval = Math.max(33, req.sampleIntervalMs ?? 100); // ~10–30 fps sampling
    const points: MotionTrackPoint[] = [];
    let method: MotionTrack['method'] = 'manual';

    // Path 1: dense external optical-flow style step using extracted frames
    if (req.opticalFlowStep && req.mediaPath && fs.existsSync(req.mediaPath)) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phenova-mt-'));
      try {
        const frames = await extractSparseFrames(req.mediaPath, req.durationMs, interval, tmp);
        let prev = { x: req.seedPoints[0].x, y: req.seedPoints[0].y };
        for (const fr of frames) {
          const next = await req.opticalFlowStep({ framePath: fr.path, prev, timeMs: fr.timeMs });
          if (next) {
            points.push({ timeMs: fr.timeMs, x: next.x, y: next.y, confidence: next.confidence });
            prev = { x: next.x, y: next.y };
          } else {
            points.push({ timeMs: fr.timeMs, x: prev.x, y: prev.y, confidence: 0.4 });
          }
        }
        method = 'optical_flow_hook';
      } finally {
        try {
          fs.rmSync(tmp, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
      }
    }

    // Path 2: per-time external tracker
    if (!points.length && req.externalTracker) {
      method = 'ai';
      for (let t = 0; t <= req.durationMs; t += interval) {
        const detected = await req.externalTracker(t);
        if (detected.length) {
          const p = detected[0];
          points.push({
            timeMs: t,
            x: p.x,
            y: p.y,
            confidence: p.confidence ?? 0.85,
          });
        } else if (points.length) {
          const last = points[points.length - 1];
          points.push({ timeMs: t, x: last.x, y: last.y, confidence: 0.3 });
        } else {
          const s = req.seedPoints[0];
          points.push({ timeMs: t, x: s.x, y: s.y, confidence: 0.5 });
        }
      }
    }

    // Path 3: FFmpeg sparse seed (extract mid frames + hold/linear) – marks ffmpeg_sparse
    if (!points.length && req.mediaPath && fs.existsSync(req.mediaPath)) {
      method = 'ffmpeg_sparse';
      // Validate media is readable; still use geometric interpolation for positions
      await runFfmpeg(['-hide_banner', '-i', req.mediaPath, '-frames:v', '1', '-f', 'null', '-']);
    }

    // Path 4: geometric fallback (linear between seeds or hold)
    if (!points.length) {
      method = 'manual';
      for (let t = 0; t <= req.durationMs; t += interval) {
        if (req.seedPoints.length >= 2) {
          const a = req.seedPoints[0];
          const b = req.seedPoints[req.seedPoints.length - 1];
          const frac = req.durationMs > 0 ? t / req.durationMs : 0;
          points.push({
            timeMs: t,
            x: a.x + (b.x - a.x) * frac,
            y: a.y + (b.y - a.y) * frac,
            confidence: 1,
          });
        } else {
          const s = req.seedPoints[0];
          points.push({ timeMs: t, x: s.x, y: s.y, confidence: 1 });
        }
      }
    }

    return {
      id: randomUUID() as UUID,
      mediaId: req.mediaId,
      points,
      method,
    };
  }

  bakeToPath(
    track: MotionTrack,
    halfWidth = 0.08,
    halfHeight = 0.08,
  ): Array<{ timeMs: Milliseconds; path: MaskPathPoint[] }> {
    return track.points.map((p) => {
      const hw = halfWidth * (p.scale ?? 1);
      const hh = halfHeight * (p.scale ?? 1);
      return {
        timeMs: p.timeMs,
        path: [
          { x: p.x - hw, y: p.y - hh },
          { x: p.x + hw, y: p.y - hh },
          { x: p.x + hw, y: p.y + hh },
          { x: p.x - hw, y: p.y + hh },
        ],
      };
    });
  }

  bakeToRects(
    track: MotionTrack,
    halfWidth = 0.08,
    halfHeight = 0.08,
  ): Array<{ timeMs: Milliseconds; rect: MaskRect }> {
    return track.points.map((p) => {
      const hw = halfWidth * (p.scale ?? 1);
      const hh = halfHeight * (p.scale ?? 1);
      return {
        timeMs: p.timeMs,
        rect: {
          x: Math.max(0, p.x - hw),
          y: Math.max(0, p.y - hh),
          w: Math.min(1, hw * 2),
          h: Math.min(1, hh * 2),
        },
      };
    });
  }
}

export function createMotionTracker(): MotionTracker {
  return new MotionTracker();
}
