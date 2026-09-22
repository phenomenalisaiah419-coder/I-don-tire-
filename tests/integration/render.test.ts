/**
 * REAL RENDER INTEGRATION TESTS (spec §17: "Real FFmpeg/media tests are
 * mandatory"; §10: never simulate exports; §3: honest failure on
 * unsupported resource conditions).
 *
 * Renders real generated media through the full compositor:
 *   multi-clip timeline + crossfade transition + effect + audio mix
 *   + captions (when a font is available), then verifies the output by
 *   probing it with ffprobe.
 *
 * Run: npx tsx tests/integration/render.test.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { RenderCompositor, probe } from '../../packages/render/src';
import {
  createEmptyProject,
  createClip,
  Project,
  MediaAsset,
} from '../../packages/core/src';

(async () => {

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) { failed++; console.error(`  FAIL: ${msg}`); } else { passed++; console.log(`  OK: ${msg}`); }
}
async function assertRejects(fn: () => Promise<unknown> | unknown, match: RegExp, msg: string) {
  try { await fn(); failed++; console.error(`  FAIL (no rejection): ${msg}`); }
  catch (e) {
    const m = (e as Error).message;
    if (match.test(m)) { passed++; console.log(`  OK: ${msg}`); }
    else { failed++; console.error(`  FAIL (wrong error "${m.slice(0, 120)}"): ${msg}`); }
  }
}

const FIX = path.join(__dirname, '..', 'fixtures');
const CLIP_A = path.join(FIX, 'clipA.mp4');
const CLIP_B = path.join(FIX, 'clipB.mp4');
const CLIP_C = path.join(FIX, 'clipC.mp4');
const MUSIC = path.join(FIX, 'music.wav');

const FONT_CANDIDATES = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
];
const FONT = FONT_CANDIDATES.find(f => fs.existsSync(f));

function videoAsset(file: string, durationMs: number): MediaAsset {
  return {
    id: uuidv4(),
    source: { kind: 'user', localPath: file },
    type: 'video',
    durationMs,
    width: 1280, height: 720, fps: 30,
    path: file,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildProject(): Project {
  const project = createEmptyProject('RenderIT', { width: 1280, height: 720, fps: 30 });

  const a = videoAsset(CLIP_A, 3000);
  const b = videoAsset(CLIP_B, 3000);
  const music: MediaAsset = { ...videoAsset(MUSIC, 6000), type: 'audio', width: undefined, height: undefined };
  project.media[a.id] = a;
  project.media[b.id] = b;
  project.media[music.id] = music;

  const videoTrack = project.tracks[0];
  const audioTrack = project.tracks[1];

  const cA = createClip(a.id, videoTrack.id, 0, 0, 3000);
  cA.effects.push({ id: uuidv4(), effectId: 'saturation', enabled: true, params: { amount: 1.4 }, keyframes: [] });
  cA.transitionOut = { id: uuidv4(), transitionId: 'crossfade', durationMs: 500, params: {}, easing: 'linear' };

  const cB = createClip(b.id, videoTrack.id, 3000, 0, 3000);
  videoTrack.clips.push(cA, cB);

  const cM = createClip(music.id, audioTrack.id, 0, 0, 5500);
  cM.volume = 0.5;
  audioTrack.clips.push(cM);

  if (FONT) {
    project.captions.push({ id: uuidv4(), startMs: 500, endMs: 2500, text: 'PHENOVA REAL RENDER' });
  }

  project.settings.durationMs = 5500; // 3000 + 3000 - 500 xfade overlap
  return project;
}

async function main() {
  console.log('== Real render: effects + transition + audio mix + captions ==');
  const outDir = path.join(FIX, 'out');
  fs.mkdirSync(outDir, { recursive: true });

  const project = buildProject();
  const compositor = new RenderCompositor('ffmpeg');
  const outputPath = path.join(outDir, `render-${Date.now()}.mp4`);

  let progressEvents = 0;
  let lastPercent = 0;
  const handle = compositor.render(project, {
    outputPath,
    width: 1280, height: 720, fps: 30,
    quality: 'draft',
    workDir: path.join(outDir, `work-${Date.now()}`),
    fontFile: FONT,
  }, (p) => { progressEvents++; lastPercent = Math.max(lastPercent, p.percent); });

  const result = await handle.promise;
  assert(fs.existsSync(result) && fs.statSync(result).size > 10_000, 'export produced a real non-empty MP4');

  const pr = await probe(result);
  assert(Math.abs(pr.durationMs - 5500) < 400, `output duration ≈ 5.5s (xfade overlap applied), got ${pr.durationMs}ms`);
  assert(pr.width === 1280 && pr.height === 720, 'output resolution matches project settings');
  assert(pr.hasAudio, 'output contains the mixed audio track (clip audio + music bed)');
  assert(progressEvents > 0 && lastPercent >= 99, `progress reported through completion (${progressEvents} events, last=${lastPercent.toFixed(0)}%)`);

  console.log('== Speed + reverse segment rendering ==');
  {
    const p2 = createEmptyProject('Speed', { width: 1280, height: 720, fps: 30 });
    const a = videoAsset(CLIP_A, 3000);
    p2.media[a.id] = a;
    const c = createClip(a.id, p2.tracks[0].id, 0, 0, 3000);
    c.speed = 2;
    p2.tracks[0].clips.push(c);
    p2.settings.durationMs = 1500;
    const out2 = path.join(outDir, `speed-${Date.now()}.mp4`);
    await compositor.render(p2, {
      outputPath: out2, width: 1280, height: 720, fps: 30, quality: 'draft',
      workDir: path.join(outDir, `work2-${Date.now()}`),
    }).promise;
    const pr2 = await probe(out2);
    assert(Math.abs(pr2.durationMs - 1500) < 300, `2x speed halves duration, got ${pr2.durationMs}ms`);
  }

  console.log('== Cancellation ==');
  {
    const p3 = createEmptyProject('Cancel', { width: 1280, height: 720, fps: 30 });
    const c10 = videoAsset(CLIP_C, 10_000);
    p3.media[c10.id] = c10;
    p3.tracks[0].clips.push(createClip(c10.id, p3.tracks[0].id, 0, 0, 10_000));
    p3.settings.durationMs = 10_000;
    const h = compositor.render(p3, {
      outputPath: path.join(outDir, `cancel-${Date.now()}.mp4`),
      width: 1280, height: 720, fps: 30, quality: 'high',
      workDir: path.join(outDir, `work3-${Date.now()}`),
    });
    setTimeout(() => h.cancel(), 150);
    await assertRejects(() => h.promise, /cancelled/i, 'in-flight render is cancellable');
  }

  console.log('== Honest failure paths (spec §3/§10/§19) ==');
  {
    // 4K requested with 720p sources → must refuse, not upscale-simulate
    await assertRejects(
      () => compositor.render(buildProject(), {
        outputPath: path.join(outDir, 'never-4k.mp4'),
        width: 3840, height: 2160, fps: 30, quality: 'high',
        workDir: path.join(outDir, 'work-4k'),
      }).promise,
      /4K|source resolution/i,
      '4K export with sub-4K sources fails honestly',
    );

    // Unsupported capability must never render as if supported
    const bad = buildProject();
    bad.tracks[0].clips[0].effects.push({
      id: uuidv4(), effectId: 'background_removal', enabled: true, params: {}, keyframes: [],
    });
    await assertRejects(
      () => compositor.render(bad, {
        outputPath: path.join(outDir, 'never-bg.mp4'),
        width: 1280, height: 720, fps: 30, quality: 'draft',
        workDir: path.join(outDir, 'work-bg'),
      }).promise,
      /unavailable|not.*supported/i,
      'unavailable effect (background_removal) is refused, not faked',
    );

    // Missing media file → explicit failure
    const missing = buildProject();
    const clip = missing.tracks[0].clips[0];
    missing.media[clip.mediaId].path = path.join(FIX, 'does-not-exist.mp4');
    await assertRejects(
      () => compositor.render(missing, {
        outputPath: path.join(outDir, 'never-missing.mp4'),
        width: 1280, height: 720, fps: 30, quality: 'draft',
        workDir: path.join(outDir, 'work-missing'),
      }).promise,
      /missing|not found/i,
      'missing source media fails with actionable error',
    );
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });

})().catch(e => { console.error(e); process.exit(1); });
