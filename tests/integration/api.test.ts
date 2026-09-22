/**
 * PRODUCTION API INTEGRATION TESTS (spec §17).
 *
 * Boots the real server (auth, durable DB, storage, job queue, real FFmpeg
 * render worker) on an ephemeral port with a temp data dir and exercises:
 *   auth (register/login/wrong-password/session authz), project CRUD +
 *   ownership isolation, chunked resumable upload with content validation,
 *   export job end-to-end (queued → processing → completed → real MP4
 *   download), plan-gated resolutions, AI-edit honest 503 without provider
 *   (and quota NOT consumed), generation policy hard-block, acquisition
 *   honest 503 without provider keys.
 *
 * Run: npx tsx tests/integration/api.test.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createEmptyProject, createClip, Project, MediaAsset } from '../../packages/core/src';

(async () => {

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) { failed++; console.error(`  FAIL: ${msg}`); } else { passed++; console.log(`  OK: ${msg}`); }
}

const FIX = path.join(__dirname, '..', 'fixtures');
const CLIP_A = path.join(FIX, 'clipA.mp4');

const DATA_DIR = `/tmp/phenova-api-it-${Date.now()}`;
process.env.PHENOVA_ENV = 'development';
process.env.PHENOVA_DATA_DIR = DATA_DIR;
process.env.PHENOVA_DB_PATH = path.join(DATA_DIR, 'it.db');
delete process.env.PHENOVA_PROVIDER_API_KEY;
delete process.env.PEXELS_API_KEY;
delete process.env.PIXABAY_API_KEY;

let base = '';

async function req(method: string, p: string, opts: { token?: string; body?: unknown; raw?: Buffer; contentType?: string } = {}) {
  const headers: Record<string, string> = {};
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
  let body: BodyInit | undefined;
  if (opts.raw) {
    body = opts.raw as unknown as BodyInit;
    headers['Content-Type'] = opts.contentType ?? 'application/octet-stream';
  } else if (opts.body !== undefined) {
    body = JSON.stringify(opts.body);
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${base}${p}`, { method, headers, body });
  const ct = res.headers.get('content-type') ?? '';
  const data = ct.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
  return { status: res.status, data };
}

function buildProjectWithClip(serverProject: any): Project {
  const project = serverProject as Project;
  const asset: MediaAsset = {
    id: uuidv4(),
    source: { kind: 'user', localPath: CLIP_A },
    type: 'video',
    durationMs: 3000,
    width: 1280, height: 720, fps: 30,
    path: CLIP_A,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  project.media[asset.id] = asset;
  project.tracks[0].clips.push(createClip(asset.id, project.tracks[0].id, 0, 0, 3000));
  project.settings = { ...project.settings, width: 1280, height: 720, fps: 30, durationMs: 3000 };
  return project;
}

async function pollJob(token: string, jobId: string, timeoutMs = 120_000): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { status, data } = await req('GET', `/v1/jobs/${jobId}`, { token });
    if (status !== 200) throw new Error(`job poll failed: ${status}`);
    if (['completed', 'failed', 'cancelled'].includes(data.state)) return data;
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('job poll timed out');
}

async function main() {
  const { bootstrap } = await import('../../services/api/src/server');
  const { server, jobs } = await bootstrap();
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
  console.log(`server on ${base}`);

  console.log('== Health & capabilities ==');
  {
    const h = await req('GET', '/health');
    assert(h.status === 200 && h.data.ok && h.data.ai === false, 'health ok; AI honestly reported unavailable (no provider key)');
    const caps = await req('GET', '/v1/capabilities?kind=effect&platform=server');
    assert(caps.status === 200 && caps.data.capabilities.every((c: any) => c.status === 'supported'), 'capability endpoint exposes only supported entries');
  }

  console.log('== Auth (spec §12/§15) ==');
  let tokenA = '', tokenB = '';
  {
    const bad = await req('POST', '/v1/auth/register', { body: { email: 'not-an-email', password: 'x' } });
    assert(bad.status === 400, 'invalid registration rejected');

    const reg = await req('POST', '/v1/auth/register', { body: { email: 'a@phenova.test', password: 'password123', displayName: 'A' } });
    assert(reg.status === 201 && reg.data.tokens.token, 'register creates account + session');
    tokenA = reg.data.tokens.token;

    const dup = await req('POST', '/v1/auth/register', { body: { email: 'a@phenova.test', password: 'password123' } });
    assert(dup.status === 409, 'duplicate email rejected');

    const wrong = await req('POST', '/v1/auth/login', { body: { email: 'a@phenova.test', password: 'wrong-password' } });
    assert(wrong.status === 401, 'wrong password rejected');

    const login = await req('POST', '/v1/auth/login', { body: { email: 'a@phenova.test', password: 'password123' } });
    assert(login.status === 200 && login.data.tokens.token, 'login issues fresh session');
    tokenA = login.data.tokens.token;

    const regB = await req('POST', '/v1/auth/register', { body: { email: 'b@phenova.test', password: 'password123' } });
    tokenB = regB.data.tokens.token;

    const noAuth = await req('GET', '/v1/projects');
    assert(noAuth.status === 401, 'unauthenticated request rejected');

    const me = await req('GET', '/v1/me', { token: tokenA });
    assert(me.status === 200 && me.data.plan === 'free' && me.data.resolutionCap === 1080, 'new account: free plan, first-3-days 1080p window');
    assert(!!me.data.pricing?.tiers?.monthly, 'pricing served from server config (not hardcoded client-side)');
  }

  console.log('== Projects: CRUD, persistence, ownership ==');
  let projectId = '';
  {
    const created = await req('POST', '/v1/projects', { token: tokenA, body: { name: 'IT Project' } });
    assert(created.status === 201 && created.data.project.meta.id, 'project created with canonical state');
    projectId = created.data.project.meta.id;
    assert(created.data.project.policy?.allowGeneration === false, 'canonical project carries explicit generation policy (spec §5)');

    const withClip = buildProjectWithClip(created.data.project);
    const saved = await req('PUT', `/v1/projects/${projectId}`, { token: tokenA, body: { project: withClip } });
    assert(saved.status === 200, 'canonical state persisted (schema-validated)');

    const loaded = await req('GET', `/v1/projects/${projectId}`, { token: tokenA });
    assert(loaded.status === 200 && loaded.data.project.tracks[0].clips.length === 1, 'project reloads with clip intact (durable persistence)');

    const stolen = await req('GET', `/v1/projects/${projectId}`, { token: tokenB });
    assert(stolen.status === 403, 'cross-user access blocked (ownership enforcement)');

    const renamed = await req('PATCH', `/v1/projects/${projectId}`, { token: tokenA, body: { name: 'Renamed' } });
    assert(renamed.status === 200, 'rename works');

    const listed = await req('GET', '/v1/projects', { token: tokenA });
    assert(listed.status === 200 && listed.data.some((p: any) => p.id === projectId), 'project listed');

    const invalid = await req('PUT', `/v1/projects/${projectId}`, { token: tokenA, body: { project: { garbage: true } } });
    assert(invalid.status >= 400, 'invalid project state rejected by schema validation');
  }

  console.log('== Chunked upload + content validation (spec §13) ==');
  {
    const buf = fs.readFileSync(CLIP_A);
    const begin = await req('POST', '/v1/uploads', { token: tokenA, body: { filename: 'clipA.mp4', totalBytes: buf.length } });
    assert(begin.status === 201 && begin.data.uploadId, 'upload session begun');
    const up = begin.data.uploadId;
    const half = Math.floor(buf.length / 2);
    const c1 = await req('PUT', `/v1/uploads/${up}/chunks/0`, { token: tokenA, raw: buf.subarray(0, half) });
    assert(c1.status === 200 && c1.data.complete === false, 'first chunk received');
    const c2 = await req('PUT', `/v1/uploads/${up}/chunks/1`, { token: tokenA, raw: buf.subarray(half) });
    assert(c2.status === 200 && c2.data.complete === true, 'second chunk completes upload');
    const done = await req('POST', `/v1/uploads/${up}/complete`, { token: tokenA, body: {} });
    assert(done.status === 201 && done.data.detectedType === 'video', 'content validated by magic bytes and registered as video');
    assert(Math.abs(done.data.probe.durationMs - 3000) < 300, 'ffprobe metadata recorded (duration, spec §8)');

    const fake = await req('POST', '/v1/uploads', { token: tokenA, body: { filename: 'evil.mp4', totalBytes: 11 } });
    const fup = fake.data.uploadId;
    await req('PUT', `/v1/uploads/${fup}/chunks/0`, { token: tokenA, raw: Buffer.from('not a video') });
    const fdone = await req('POST', `/v1/uploads/${fup}/complete`, { token: tokenA, body: {} });
    assert(fdone.status === 400, 'extension-spoofed file rejected by content validation');
  }

  console.log('== Export job: real render through the queue (spec §10/§17) ==');
  {
    const exp = await req('POST', `/v1/projects/${projectId}/export`, { token: tokenA, body: { width: 1280, height: 720, fps: 30, quality: 'draft' } });
    assert(exp.status === 202 && exp.data.job.state === 'queued', 'export enqueued as durable job');
    const job = await pollJob(tokenA, exp.data.job.id);
    assert(job.state === 'completed', `render job completed (state=${job.state}, error=${job.error ?? 'none'})`);
    const dl = await req('GET', `/v1/jobs/${job.id}/download`, { token: tokenA });
    assert(dl.status === 200 && (dl.data as Buffer).length > 10_000, 'exported MP4 downloadable and non-empty (real render, not simulated)');
    const sig = (dl.data as Buffer).toString('ascii', 4, 8);
    assert(sig === 'ftyp', 'downloaded file is a valid MP4 container');

    const fourK = await req('POST', `/v1/projects/${projectId}/export`, { token: tokenA, body: { width: 3840, height: 2160 } });
    assert(fourK.status === 402, '4K export refused by plan gate on free tier (honest, server-enforced)');

    const foreign = await req('GET', `/v1/jobs/${job.id}`, { token: tokenB });
    assert(foreign.status === 403, 'job ownership enforced');
  }

  console.log('== AI edit: honest 503 without provider, quota untouched ==');
  {
    const ai = await req('POST', `/v1/projects/${projectId}/ai-edit`, { token: tokenA, body: { instruction: 'make a 30s cinematic edit' } });
    assert(ai.status === 503, 'AI edit fails honestly when no provider configured (no fake AI, spec §1)');
    const me = await req('GET', '/v1/me', { token: tokenA });
    assert(me.data.quotaToday.pro_edits_used === 0, 'validation failure did NOT consume edit quota (spec §12)');
  }

  console.log('== Generation: explicit-policy hard gate (spec §5) ==');
  {
    const blocked = await req('POST', '/v1/generate/video', { token: tokenA, body: { prompt: 'neon city flyover', projectId } });
    assert(blocked.status === 403 && blocked.data.code === 'POLICY_BLOCKED', 'generation blocked when project policy forbids it ("do not generate" is a hard constraint)');

    const noProject = await req('POST', '/v1/generate/video', { token: tokenA, body: { prompt: 'neon city flyover' } });
    assert(noProject.status === 202, 'explicit generation request without project policy accepted as job');
    const job = await pollJob(tokenA, noProject.data.job.id);
    assert(job.state === 'failed' && /not configured/i.test(job.error ?? ''), 'generation without provider fails honestly, never simulates an asset');
  }

  console.log('== Acquisition: honest 503 without licensed provider keys ==');
  {
    const s = await req('GET', '/v1/acquisition/search?q=ocean&type=video', { token: tokenA });
    assert(s.status === 503, 'acquisition reports honest unavailability without provider keys (no scraping fallback)');
  }

  console.log('== Logout revokes session ==');
  {
    const out = await req('POST', '/v1/auth/logout', { token: tokenA });
    assert(out.status === 200, 'logout ok');
    const after = await req('GET', '/v1/projects', { token: tokenA });
    assert(after.status === 401, 'revoked session no longer authenticates');
  }

  jobs.stop();
  server.close();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });

})().catch(e => { console.error(e); process.exit(1); });
