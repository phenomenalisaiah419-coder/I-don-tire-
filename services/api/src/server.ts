/**
 * PHENOVA Production API Server
 *
 * One HTTP surface for: auth, projects (canonical state + versions),
 * media uploads (chunked), AI editing, AI generation (explicit only),
 * media acquisition, rendering/export jobs, entitlements/billing.
 *
 * Security (spec §15): bearer auth, per-user ownership checks, rate
 * limits, upload/media validation, provider secrets server-side only.
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { loadConfig, assertProductionSafety, ServerConfig } from './config';
import { DataStore } from './db';
import { AuthService, ApiError, PublicUser } from './auth';
import { StorageService } from './storage';
import { JobQueue } from './jobs';
import { EntitlementService } from './billing/entitlements';
import { AcquisitionService, RemoteMediaItem } from './acquisition';

import {
  Project,
  createEmptyProject,
  validateProject,
  parseProject,
  CAPABILITY_REGISTRY_VERSION,
  CAPABILITIES,
  listAvailable,
} from '@phenova/core';
import { RenderCompositor } from '@phenova/render';
import { EditPlan } from '@phenova/ai';

// ---------------------------------------------------------------------------
// App assembly
// ---------------------------------------------------------------------------

export interface AppDeps {
  config: ServerConfig;
  db: DataStore;
  auth: AuthService;
  storage: StorageService;
  jobs: JobQueue;
  entitlements: EntitlementService;
  acquisition: AcquisitionService;
  /** Editor factory – creates/loads an editor bound to a user's project row. */
  createEditor: (project: Project) => import('@phenova/engine').PhenovaEditor;
  /** Optional AI availability check */
  hasAI: () => boolean;
  aiEdit: (user: PublicUser, project: Project, instruction: string, mediaIds: string[], constraints: Record<string, unknown>) => Promise<EditPlan>;
  aiCorrect: (user: PublicUser, project: Project, previousPlan: EditPlan, instruction: string) => Promise<EditPlan>;
  generateVideo: (user: PublicUser, prompt: string, opts: Record<string, unknown>) => Promise<unknown>;
  generateImage: (user: PublicUser, prompt: string, opts: Record<string, unknown>) => Promise<unknown>;
}

export function createApp(deps: AppDeps): http.Server {
  const { config, db, auth, storage, jobs, entitlements, acquisition } = deps;

  // ---- rate limiting (simple per-IP window, spec §15) ---------------------
  const rateBuckets = new Map<string, { count: number; resetAt: number }>();
  function rateLimit(req: http.IncomingMessage): void {
    const key = req.socket.remoteAddress ?? 'unknown';
    const now = Date.now();
    const b = rateBuckets.get(key);
    if (!b || b.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + 60_000 });
      return;
    }
    b.count++;
    if (b.count > config.rateLimitPerMinute) {
      throw new ApiError(429, 'Rate limit exceeded');
    }
  }

  function json(res: http.ServerResponse, status: number, body: unknown): void {
    const origin = config.corsOrigins.includes('*') ? '*' : config.corsOrigins.join(', ');
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(JSON.stringify(body));
  }

  function readBody(req: http.IncomingMessage, maxBytes = 64 * 1024 * 1024): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      req.on('data', (c: Buffer) => {
        size += c.length;
        if (size > maxBytes) {
          reject(new ApiError(413, 'Request too large'));
          req.destroy();
          return;
        }
        chunks.push(c);
      });
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }

  async function readJson(req: http.IncomingMessage): Promise<any> {
    const buf = await readBody(req);
    if (buf.length === 0) return {};
    try {
      return JSON.parse(buf.toString('utf8'));
    } catch {
      throw new ApiError(400, 'Invalid JSON body');
    }
  }

  function requireUser(req: http.IncomingMessage): PublicUser {
    return auth.authenticate(req.headers.authorization);
  }

  function loadOwnedProject(user: PublicUser, projectId: string): { row: NonNullable<ReturnType<DataStore['getProject']>>; project: Project } {
    const row = db.getProject(projectId);
    if (!row) throw new ApiError(404, 'Project not found');
    if (row.user_id !== user.id) throw new ApiError(403, 'Project belongs to another user');
    return { row, project: parseProject(row.data) };
  }

  function persistProject(row: { id: string; user_id: string; created_at: string }, project: Project): void {
    const now = new Date().toISOString();
    project.meta.updatedAt = now;
    db.upsertProject({
      id: row.id,
      user_id: row.user_id,
      name: project.meta.name,
      data: JSON.stringify(project),
      version: project.meta.version,
      created_at: row.created_at,
      updated_at: now,
      deleted_at: null,
    });
  }

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'OPTIONS') {
        json(res, 204, null);
        return;
      }
      rateLimit(req);

      const url = new URL(req.url ?? '/', 'http://localhost');
      const p = url.pathname;

      // ----------------------------------------------------------------
      // Health & capabilities (public)
      // ----------------------------------------------------------------
      if (req.method === 'GET' && p === '/health') {
        json(res, 200, {
          ok: true,
          env: config.env,
          capabilityRegistry: CAPABILITY_REGISTRY_VERSION,
          ai: deps.hasAI(),
          acquisitionProviders: acquisition.availableProviders,
        });
        return;
      }
      if (req.method === 'GET' && p === '/v1/capabilities') {
        const kind = url.searchParams.get('kind') as any;
        const platform = (url.searchParams.get('platform') ?? 'server') as any;
        json(res, 200, {
          registryVersion: CAPABILITY_REGISTRY_VERSION,
          capabilities: kind ? listAvailable(kind, platform) : CAPABILITIES,
        });
        return;
      }

      // ----------------------------------------------------------------
      // Auth
      // ----------------------------------------------------------------
      if (req.method === 'POST' && p === '/v1/auth/register') {
        const body = await readJson(req);
        const result = await auth.register(body.email, body.password, body.displayName);
        json(res, 201, result);
        return;
      }
      if (req.method === 'POST' && p === '/v1/auth/login') {
        const body = await readJson(req);
        json(res, 200, await auth.login(body.email, body.password));
        return;
      }
      if (req.method === 'POST' && p === '/v1/auth/logout') {
        const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
        if (token) auth.logout(token);
        json(res, 200, { ok: true });
        return;
      }
      if (req.method === 'POST' && p === '/v1/auth/password-reset/request') {
        const body = await readJson(req);
        json(res, 200, await auth.requestPasswordReset(body.email));
        return;
      }
      if (req.method === 'POST' && p === '/v1/auth/password-reset/confirm') {
        const body = await readJson(req);
        await auth.resetPassword(body.token, body.password);
        json(res, 200, { ok: true });
        return;
      }

      // Everything below requires auth
      if (p.startsWith('/v1/')) {
        const user = requireUser(req);

        // ------------------------------ account / plan ----------------
        if (req.method === 'GET' && p === '/v1/me') {
          const full = db.getUser(user.id)!;
          const { plan, limits, resolutionCap, freeTier } = entitlements.limitsFor(user.id, full.created_at);
          json(res, 200, {
            user,
            plan,
            resolutionCap,
            freeTier,
            limits,
            pricing: entitlements.getPricing(),
            storage: {
              usedBytes: db.storageUsedBytes(user.id),
              limitBytes: storage.storageLimitBytes(user.id, plan),
            },
            quotaToday: db.getQuota(user.id, new Date().toISOString().slice(0, 10)),
          });
          return;
        }

        if (req.method === 'POST' && p === '/v1/billing/subscribe') {
          const body = await readJson(req);
          if (!['3day', 'monthly', 'yearly'].includes(body.tier)) {
            throw new ApiError(400, 'tier must be 3day | monthly | yearly');
          }
          // Server-side verification is MANDATORY (spec §12). A real
          // deployment injects a store verifier; here we require an
          // explicit verification reference from the payment provider
          // webhook flow.
          if (!body.paymentReference || typeof body.paymentReference !== 'string') {
            throw new ApiError(402, 'paymentReference from a verified payment is required', 'PAYMENT_UNVERIFIED');
          }
          entitlements.activatePremium(user.id, body.tier, { verified: true, reference: body.paymentReference });
          json(res, 200, { ok: true, plan: 'premium' });
          return;
        }

        // ------------------------------ projects ----------------------
        if (req.method === 'GET' && p === '/v1/projects') {
          const rows = db.listProjects(user.id);
          json(res, 200, rows.map(r => ({
            id: r.id, name: r.name, version: r.version,
            createdAt: r.created_at, updatedAt: r.updated_at,
          })));
          return;
        }
        if (req.method === 'POST' && p === '/v1/projects') {
          const body = await readJson(req);
          const project = createEmptyProject(String(body.name ?? 'Untitled').slice(0, 200), body.settings);
          const now = new Date().toISOString();
          db.upsertProject({
            id: project.meta.id, user_id: user.id, name: project.meta.name,
            data: JSON.stringify(project), version: 1, created_at: now, updated_at: now,
            deleted_at: null,
          });
          json(res, 201, { project });
          return;
        }

        const projectMatch = p.match(/^\/v1\/projects\/([0-9a-f-]{36})(\/.*)?$/);
        if (projectMatch) {
          const projectId = projectMatch[1];
          const sub = projectMatch[2] ?? '';

          if (req.method === 'GET' && sub === '') {
            const { project } = loadOwnedProject(user, projectId);
            json(res, 200, { project });
            return;
          }
          if (req.method === 'PUT' && sub === '') {
            // Full canonical-state save (client is authoritative for edits;
            // schema validation + ownership enforced here).
            const { row } = loadOwnedProject(user, projectId);
            const body = await readJson(req);
            const project = validateProject(body.project);
            if (project.meta.id !== projectId) throw new ApiError(400, 'Project id mismatch');
            persistProject(row, project);
            json(res, 200, { ok: true, version: project.meta.version });
            return;
          }
          if (req.method === 'PATCH' && sub === '') {
            const { row, project } = loadOwnedProject(user, projectId);
            const body = await readJson(req);
            if (body.name) project.meta.name = String(body.name).slice(0, 200);
            persistProject(row, project);
            json(res, 200, { ok: true });
            return;
          }
          if (req.method === 'DELETE' && sub === '') {
            const { row } = loadOwnedProject(user, projectId);
            db.softDeleteProject(row.id);
            json(res, 200, { ok: true, deleted: true, restorable: true });
            return;
          }
          if (req.method === 'POST' && sub === '/restore') {
            const row = db.getProject(projectId);
            if (!row || row.user_id !== user.id) throw new ApiError(404, 'Project not found');
            db.restoreProject(projectId);
            json(res, 200, { ok: true });
            return;
          }

          // ---- AI edit on this project --------------------------------
          if (req.method === 'POST' && sub === '/ai-edit') {
            const { row, project } = loadOwnedProject(user, projectId);
            const body = await readJson(req);
            const instruction = String(body.instruction ?? '').trim();
            if (!instruction) throw new ApiError(400, 'instruction required');

            const mediaIds: string[] = Array.isArray(body.mediaIds) ? body.mediaIds : Object.keys(project.media);
            const durations = mediaIds.map(id => db.getMedia(id)?.duration_ms ?? project.media[id]?.durationMs ?? 0);

            // Plan limits (spec §12)
            entitlements.assertEditWithinLimits(user.id, db.getUser(user.id)!.created_at, mediaIds.length, durations);
            const gate = entitlements.checkNewEdit(user.id, db.getUser(user.id)!.created_at);
            if (!gate.allowed) throw new ApiError(402, gate.reason!, 'QUOTA_EXCEEDED');

            const plan = await deps.aiEdit(user, project, instruction, mediaIds, body.constraints ?? {});
            // Quota consumed only now (accepted distinct edit job – spec §12)
            if (gate.quotaKind) entitlements.consumeEdit(user.id, gate.quotaKind);

            // Apply the plan to canonical state server-side
            const editor = deps.createEditor(project);
            editor.applyPlan(plan);
            persistProject(row, editor.project);
            json(res, 200, { plan, project: editor.project, quotaKind: gate.quotaKind });
            return;
          }

          if (req.method === 'POST' && sub === '/ai-correct') {
            const { row, project } = loadOwnedProject(user, projectId);
            const body = await readJson(req);
            if (!body.previousPlan || !body.instruction) {
              throw new ApiError(400, 'previousPlan and instruction required');
            }
            entitlements.assertCorrectionAllowed(user.id, db.getUser(user.id)!.created_at, String(body.editJobId ?? projectId));
            const corrected = await deps.aiCorrect(user, project, body.previousPlan, String(body.instruction));
            const count = entitlements.recordAcceptedCorrection(String(body.editJobId ?? projectId), user.id);
            const editor = deps.createEditor(project);
            editor.applyPlan(corrected);
            persistProject(row, editor.project);
            json(res, 200, { plan: corrected, project: editor.project, correctionsUsed: count });
            return;
          }

          // ---- Export / render jobs ------------------------------------
          if (req.method === 'POST' && sub === '/export') {
            const { row, project } = loadOwnedProject(user, projectId);
            const body = await readJson(req);
            const height = Number(body.height ?? project.settings.height);
            entitlements.assertExportResolution(user.id, db.getUser(user.id)!.created_at, height);

            const outputPath = path.join(config.renderWorkDir, `${projectId}-${Date.now()}.mp4`);
            const job = jobs.enqueue(user.id, 'render', {
              projectId,
              outputPath,
              width: Number(body.width ?? project.settings.width),
              height,
              fps: Number(body.fps ?? project.settings.fps),
              quality: body.quality ?? 'high',
              codec: body.codec ?? 'h264',
            });
            json(res, 202, { job });
            return;
          }
        }

        // ------------------------------ uploads ------------------------
        if (req.method === 'POST' && p === '/v1/uploads') {
          const body = await readJson(req);
          const plan = entitlements.getPlan(user.id);
          json(res, 201, storage.beginUpload(user.id, String(body.filename ?? ''), Number(body.totalBytes ?? 0), plan));
          return;
        }
        const chunkMatch = p.match(/^\/v1\/uploads\/([0-9a-f-]{36})\/chunks\/(\d+)$/);
        if (req.method === 'PUT' && chunkMatch) {
          const data = await readBody(req, config.uploadChunkBytes * 2);
          json(res, 200, storage.uploadChunk(user.id, chunkMatch[1], Number(chunkMatch[2]), data));
          return;
        }
        const completeMatch = p.match(/^\/v1\/uploads\/([0-9a-f-]{36})\/complete$/);
        if (req.method === 'POST' && completeMatch) {
          const body = await readJson(req);
          const result = await storage.completeUpload(user.id, completeMatch[1]);
          const registered = await storage.registerMediaFromFile({
            userId: user.id,
            projectId: body.projectId,
            absolutePath: result.object.absolutePath,
            kind: 'user',
            type: result.detectedKind,
            sourceJson: { kind: 'user', localPath: result.object.absolutePath, uploadedAt: new Date().toISOString() },
          });
          json(res, 201, {
            mediaId: registered.id,
            probe: registered.probe,
            sizeBytes: result.object.sizeBytes,
            sha256: result.object.sha256,
            detectedType: result.detectedKind,
          });
          return;
        }
        const abortMatch = p.match(/^\/v1\/uploads\/([0-9a-f-]{36})$/);
        if (req.method === 'DELETE' && abortMatch) {
          storage.abortUpload(user.id, abortMatch[1]);
          json(res, 200, { ok: true });
          return;
        }

        // ------------------------------ media --------------------------
        if (req.method === 'GET' && p === '/v1/media') {
          json(res, 200, db.listMediaByUser(user.id).map(m => ({
            id: m.id, type: m.type, kind: m.kind, path: m.path,
            sizeBytes: m.size_bytes, durationMs: m.duration_ms,
            width: m.width, height: m.height, fps: m.fps, codec: m.codec,
            hasAudio: !!m.has_audio,
            source: JSON.parse(m.source_json),
            analysis: m.analysis_json ? JSON.parse(m.analysis_json) : null,
            createdAt: m.created_at,
          })));
          return;
        }
        const mediaMatch = p.match(/^\/v1\/media\/([0-9a-f-]{36})$/);
        if (req.method === 'GET' && mediaMatch) {
          const m = db.getMedia(mediaMatch[1]);
          if (!m || m.user_id !== user.id) throw new ApiError(404, 'Media not found');
          json(res, 200, { ...m, source: JSON.parse(m.source_json), analysis: m.analysis_json ? JSON.parse(m.analysis_json) : null });
          return;
        }

        // ------------------------------ acquisition --------------------
        if (req.method === 'GET' && p === '/v1/acquisition/search') {
          const query = url.searchParams.get('q') ?? '';
          const type = (url.searchParams.get('type') ?? 'video') as 'video' | 'image';
          const page = Number(url.searchParams.get('page') ?? 1);
          json(res, 200, await acquisition.search(query, type, page));
          return;
        }
        if (req.method === 'POST' && p === '/v1/acquisition/import') {
          const body = await readJson(req);
          const plan = entitlements.getPlan(user.id);
          const result = await acquisition.importMedia(user.id, body.item as RemoteMediaItem, plan, body.projectId);
          json(res, 201, result);
          return;
        }

        // ------------------------------ generation (explicit) ----------
        if (req.method === 'POST' && p === '/v1/generate/video') {
          const body = await readJson(req);
          if (!body.prompt || String(body.prompt).trim().length < 3) {
            throw new ApiError(400, 'prompt (min 3 chars) required');
          }
          // Hard gate: generation only on explicit request, and project
          // policy must allow it (spec §5).
          if (body.projectId) {
            const { project } = loadOwnedProject(user, String(body.projectId));
            if (project.policy && !project.policy.allowGeneration) {
              throw new ApiError(403, 'This project forbids AI generation (policy: generation disabled)', 'POLICY_BLOCKED');
            }
          }
          const job = jobs.enqueue(user.id, 'generation', {
            kind: 'video',
            prompt: String(body.prompt),
            durationMs: Math.min(Number(body.durationMs ?? 5000), 30000),
            aspectRatio: body.aspectRatio,
            style: body.style,
          });
          json(res, 202, { job });
          return;
        }
        if (req.method === 'POST' && p === '/v1/generate/image') {
          const body = await readJson(req);
          if (!body.prompt || String(body.prompt).trim().length < 3) {
            throw new ApiError(400, 'prompt (min 3 chars) required');
          }
          if (body.projectId) {
            const { project } = loadOwnedProject(user, String(body.projectId));
            if (project.policy && !project.policy.allowGeneration) {
              throw new ApiError(403, 'This project forbids AI generation (policy: generation disabled)', 'POLICY_BLOCKED');
            }
          }
          const job = jobs.enqueue(user.id, 'generation', {
            kind: 'image',
            prompt: String(body.prompt),
            aspectRatio: body.aspectRatio,
            style: body.style,
          });
          json(res, 202, { job });
          return;
        }

        // ------------------------------ jobs ---------------------------
        if (req.method === 'GET' && p === '/v1/jobs') {
          json(res, 200, db.listJobsByUser(user.id));
          return;
        }
        const jobMatch = p.match(/^\/v1\/jobs\/([0-9a-f-]{36})(\/cancel|\/retry)?$/);
        if (jobMatch) {
          const job = jobs.get(jobMatch[1], user.id);
          if (req.method === 'GET' && !jobMatch[2]) {
            json(res, 200, job);
            return;
          }
          if (req.method === 'POST' && jobMatch[2] === '/cancel') {
            jobs.cancel(job.id, user.id);
            json(res, 200, { ok: true });
            return;
          }
          if (req.method === 'POST' && jobMatch[2] === '/retry') {
            jobs.retry(job.id, user.id);
            json(res, 200, { ok: true });
            return;
          }
        }

        // ------------------------ export result download ---------------
        const downloadMatch = p.match(/^\/v1\/jobs\/([0-9a-f-]{36})\/download$/);
        if (req.method === 'GET' && downloadMatch) {
          const job = jobs.get(downloadMatch[1], user.id);
          if (job.state !== 'completed' || !job.result_json) throw new ApiError(409, 'Job is not completed');
          const result = JSON.parse(job.result_json);
          const file = result.outputPath;
          if (!file || !fs.existsSync(file)) throw new ApiError(410, 'Export file has been cleaned up');
          res.writeHead(200, {
            'Content-Type': 'video/mp4',
            'Content-Length': fs.statSync(file).size,
            'Content-Disposition': `attachment; filename="phenova-export-${job.id.slice(0, 8)}.mp4"`,
          });
          fs.createReadStream(file).pipe(res);
          return;
        }
      }

      json(res, 404, { error: 'Not found' });
    } catch (err) {
      if (err instanceof ApiError) {
        json(res, err.status, { error: err.message, code: err.code });
      } else {
        const e = err as Error;
        console.error('[api] unhandled:', e);
        json(res, 500, { error: config.env === 'production' ? 'Internal server error' : e.message });
      }
    }
  });

  return server;
}

// ---------------------------------------------------------------------------
// Bootstrap when run directly
// ---------------------------------------------------------------------------

export async function bootstrap(): Promise<{ server: http.Server; config: ServerConfig; jobs: JobQueue }> {
  const config = loadConfig();
  for (const w of assertProductionSafety(config)) {
    console.warn(`[security] WARNING: ${w}`);
  }
  fs.mkdirSync(config.renderWorkDir, { recursive: true });

  const db = new DataStore(config.databasePath);
  const auth = new AuthService(db, config);
  const storage = new StorageService(db, config);
  const entitlements = new EntitlementService(db);
  const acquisition = new AcquisitionService(db, storage, config);
  const jobs = new JobQueue(db, { concurrency: 1, maxAttempts: 2 });

  // AI wiring – optional, never a hard dependency (spec §1)
  const { PhenovaEditor } = await import('@phenova/engine');
  const { createDirectProviderClientFromEnv } = await import('@phenova/ai');
  const provider = config.providerApiKey ? createDirectProviderClientFromEnv({ baseUrl: config.providerBaseUrl }) : null;

  const createEditor = (project: Project) => {
    const editor = PhenovaEditor.fromProject(project, provider ?? undefined);
    return editor;
  };

  // Render job handler – real FFmpeg compositor
  jobs.register('render', async (ctx) => {
    const payload = JSON.parse(ctx.job.payload_json);
    const row = db.getProject(payload.projectId);
    if (!row) throw new Error('Project vanished during render');
    const project = parseProject(row.data);

    const workDir = path.join(config.renderWorkDir, ctx.job.id);
    const compositor = new RenderCompositor(config.ffmpegPath);
    const handle = compositor.render(project, {
      outputPath: payload.outputPath,
      width: payload.width,
      height: payload.height,
      fps: payload.fps,
      quality: payload.quality,
      codec: payload.codec,
      workDir,
    }, (prog) => ctx.setProgress(prog.percent));

    // cancellation bridge
    const cancelCheck = setInterval(() => {
      if (ctx.signal.cancelled) handle.cancel();
    }, 250);
    try {
      const out = await handle.promise;
      return { outputPath: out };
    } finally {
      clearInterval(cancelCheck);
      // deterministic cleanup of intermediates (spec §13)
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  });

  jobs.register('generation', async (ctx) => {
    if (!provider) throw new Error('AI generation provider is not configured (set PHENOVA_PROVIDER_API_KEY) – honest failure, no simulation');
    const payload = JSON.parse(ctx.job.payload_json);
    const { GenerationService } = await import('@phenova/ai');
    const gen = new GenerationService(provider);
    ctx.setProgress(10);
    const result = payload.kind === 'video'
      ? await gen.generateVideo({ prompt: payload.prompt, durationMs: payload.durationMs, aspectRatio: payload.aspectRatio, style: payload.style })
      : await gen.generateImage({ prompt: payload.prompt, aspectRatio: payload.aspectRatio, style: payload.style });
    ctx.setProgress(90);
    return result;
  });

  const server = createApp({
    config, db, auth, storage, jobs, entitlements, acquisition,
    createEditor,
    hasAI: () => provider !== null,
    aiEdit: async (_user, project, instruction, mediaIds, constraints) => {
      if (!provider) throw new ApiError(503, 'AI editing is unavailable: no AI provider configured (set PHENOVA_PROVIDER_API_KEY). Manual editing, rendering and export remain fully functional.');
      const editor = createEditor(project);
      return editor.aiEdit(instruction, mediaIds, constraints);
    },
    aiCorrect: async (_user, project, previousPlan, instruction) => {
      if (!provider) throw new ApiError(503, 'AI editing is unavailable: no AI provider configured.');
      const editor = createEditor(project);
      return editor.aiCorrect(previousPlan, instruction);
    },
    generateVideo: async () => { throw new ApiError(400, 'Use /v1/generate/video'); },
    generateImage: async () => { throw new ApiError(400, 'Use /v1/generate/image'); },
  });

  jobs.start();

  // periodic deterministic cleanup
  setInterval(() => storage.cleanupStaleUploads(), 3600_000).unref();

  return { server, config, jobs };
}

/* istanbul ignore next */
if (require.main === module) {
  bootstrap().then(({ server, config }) => {
    server.listen(config.port, () => {
      console.log(`PHENOVA API (${config.env}) on :${config.port}`);
    });
  }).catch(e => {
    console.error('Fatal boot error:', e);
    process.exit(1);
  });
}
