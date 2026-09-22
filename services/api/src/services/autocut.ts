/**
 * AutoCut – scene-aware cut points via FFmpeg scene detection.
 * Falls back to uniform interval cuts when ffmpeg is unavailable.
 */
import { spawn } from 'child_process';
import * as fs from 'fs';

export interface AutoCutRequest {
  mediaPath?: string;
  mediaId?: string;
  targetDurationMs?: number;
  sensitivity?: number; // 0.1 .. 0.6 typical for scene score
}

export interface CutPoint {
  timeMs: number;
  score: number;
}

export interface AutoCutResult {
  cuts: CutPoint[];
  method: 'ffmpeg_scene' | 'uniform';
  mediaPath?: string;
  mediaId?: string;
}

function run(cmd: string, args: string[]): Promise<{ code: number; stderr: string; stdout: string }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    let stdout = '';
    proc.stderr?.on('data', (d) => (stderr += d.toString()));
    proc.stdout?.on('data', (d) => (stdout += d.toString()));
    proc.on('close', (code) => resolve({ code: code ?? 1, stderr, stdout }));
    proc.on('error', () => resolve({ code: 127, stderr: 'spawn failed', stdout: '' }));
  });
}

/** Parse ffmpeg showinfo / scene scores from stderr. */
function parseSceneCuts(stderr: string): CutPoint[] {
  const cuts: CutPoint[] = [];
  // match pts_time:X.XX ... scene_score or showinfo
  const re = /pts_time:([\d.]+).*?scene[_ ]?score[:\s]+([\d.]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stderr))) {
    const timeMs = Math.round(parseFloat(m[1]) * 1000);
    const score = parseFloat(m[2]);
    cuts.push({ timeMs, score });
  }
  // Alternate: lavfi metadata
  if (!cuts.length) {
    const re2 = /lavfi\.scene_score=([\d.]+).*?pts_time:([\d.]+)/gi;
    while ((m = re2.exec(stderr))) {
      cuts.push({ timeMs: Math.round(parseFloat(m[2]) * 1000), score: parseFloat(m[1]) });
    }
  }
  // select filter prints: frame:n ...
  if (!cuts.length) {
    const re3 = /t:([\d.]+).*scene:([\d.]+)/gi;
    while ((m = re3.exec(stderr))) {
      const score = parseFloat(m[2]);
      if (score > 0.2) cuts.push({ timeMs: Math.round(parseFloat(m[1]) * 1000), score });
    }
  }
  return cuts.sort((a, b) => a.timeMs - b.timeMs);
}

export async function autoCut(req: AutoCutRequest): Promise<AutoCutResult> {
  const sensitivity = Math.min(0.6, Math.max(0.1, req.sensitivity ?? 0.3));
  const path = req.mediaPath;

  if (path && fs.existsSync(path)) {
    // FFmpeg scene detection – select frames where scene changes
    const args = [
      '-hide_banner',
      '-i', path,
      '-filter:v', `select='gt(scene,${sensitivity})',showinfo`,
      '-f', 'null',
      '-',
    ];
    const { code, stderr } = await run('ffmpeg', args);
    if (code === 0 || stderr.includes('pts_time') || stderr.includes('scene')) {
      const cuts = parseSceneCuts(stderr);
      if (cuts.length) {
        return { cuts, method: 'ffmpeg_scene', mediaPath: path, mediaId: req.mediaId };
      }
    }
  }

  // Uniform fallback
  const target = req.targetDurationMs ?? 30000;
  const step = 3000;
  const cuts: CutPoint[] = [];
  for (let t = step; t < target; t += step) {
    cuts.push({ timeMs: t, score: 0.5 });
  }
  return { cuts, method: 'uniform', mediaPath: path, mediaId: req.mediaId };
}
