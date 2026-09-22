/**
 * Proxy manager integration — real FFmpeg proxy + thumb generation.
 * Run: npx tsx tests/integration/proxy.test.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { ProxyManager } from '../../packages/render/src/proxy';

const FIX = path.join(__dirname, '..', 'fixtures');
const OUT = path.join(__dirname, '..', 'tmp-proxy');

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('  OK:', msg);
}

async function makeSample(out: string, durationSec = 2): Promise<void> {
  if (fs.existsSync(out) && fs.statSync(out).size > 1000) return;
  await new Promise<void>((resolve, reject) => {
    const args = [
      '-y', '-f', 'lavfi', '-i', `testsrc=size=640x360:rate=24:duration=${durationSec}`,
      '-f', 'lavfi', '-i', `sine=frequency=440:duration=${durationSec}`,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', out,
    ];
    const p = spawn('ffmpeg', args, { stdio: 'ignore' });
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error('ffmpeg sample failed'))));
    p.on('error', reject);
  });
}

(async () => {
  console.log('== Proxy manager ==');
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(FIX, { recursive: true });
  const sample = path.join(FIX, 'proxy_sample.mp4');
  await makeSample(sample, 2);

  const pm = new ProxyManager({ cacheDir: OUT, maxWidth: 320, concurrency: 1, filmstripCount: 4 });
  const r1 = await pm.ensureProxy(sample, 'media_a', { filmstrip: true });
  assert(fs.existsSync(r1.proxyPath) && fs.statSync(r1.proxyPath).size > 0, 'proxy file created');
  assert(fs.existsSync(r1.thumbnailPath) && fs.statSync(r1.thumbnailPath).size > 0, 'thumbnail created');
  assert(!!r1.filmstripPath && fs.existsSync(r1.filmstripPath!), 'filmstrip path present');

  const r2 = await pm.ensureProxy(sample, 'media_a', { filmstrip: true });
  assert(r2.alreadyExisted === true, 'second ensure is cache hit');

  const scrub = await pm.scrubFrame('media_a', 500);
  assert(fs.existsSync(scrub) && fs.statSync(scrub).size > 0, 'scrub frame extracted');

  const batch = await pm.ensureProxies([{ mediaPath: sample, mediaId: 'media_b' }]);
  assert(batch.length === 1 && fs.existsSync(batch[0].proxyPath), 'batch ensure works');

  console.log('\nAll proxy tests passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
