/**
 * Scrub-path micro-benchmark (Node) — mirrors Flutter performance.dart logic.
 * Run: npx tsx tests/unit/scrub-bench.test.ts
 */

type Ms = number;

interface Clip {
  id: string;
  timelineStartMs: Ms;
  timelineEndMs: Ms;
}

interface Project {
  clips: Clip[];
}

function magneticSnap(
  candidateMs: number,
  clips: Clip[],
  playheadMs: number,
  thresholdMs = 100
): { ms: number; snapped: boolean } {
  const targets = new Set<number>([0, playheadMs]);
  for (const c of clips) {
    targets.add(c.timelineStartMs);
    targets.add(c.timelineEndMs);
  }
  let best = candidateMs;
  let bestDist = thresholdMs + 1;
  for (const t of targets) {
    const d = Math.abs(candidateMs - t);
    if (d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  return bestDist <= thresholdMs ? { ms: best, snapped: true } : { ms: candidateMs, snapped: false };
}

function visibleWindow(scrollPx: number, viewportPx: number, ppm: number, pad = 2000) {
  const start = Math.max(0, Math.round(scrollPx / ppm - pad));
  const end = Math.round((scrollPx + viewportPx) / ppm + pad);
  return { start, end };
}

function visibleClips(clips: Clip[], w: { start: number; end: number }) {
  return clips.filter((c) => c.timelineEndMs >= w.start && c.timelineStartMs <= w.end);
}

const clips: Clip[] = [];
let t = 0;
for (let i = 0; i < 40; i++) {
  clips.push({ id: `c${i}`, timelineStartMs: t, timelineEndMs: t + 3000 });
  t += 2800;
}

const iterations = 20000;
const playhead = 15000;
const start = performance.now();
let snaps = 0;
for (let i = 0; i < iterations; i++) {
  const candidate = playhead + (i % 200) - 100;
  const s = magneticSnap(candidate, clips, playhead, 100);
  if (s.snapped) snaps++;
  const w = visibleWindow(i % 500, 400, 0.08);
  visibleClips(clips, w);
}
const elapsed = performance.now() - start;
const us = (elapsed * 1000) / iterations;
console.log(`SCRUB_BENCH_NODE iterations=${iterations} elapsed_ms=${elapsed.toFixed(1)} us_per_iter=${us.toFixed(2)} snap_hits=${snaps}`);
if (us > 50) {
  console.error('FAIL: scrub logic slower than 50µs/iter on Node');
  process.exit(1);
}
console.log('  OK: scrub micro-benchmark within budget');
