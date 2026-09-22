/**
 * Phenova Engine HTTP Bridge
 *
 * Exposes the real PhenovaEditor over HTTP so the Flutter client
 * can drive manual edits and AI planning (via direct PHENOVA providers).
 *
 * Endpoints:
 *   GET  /health
 *   GET  /project
 *   POST /media          { media }
 *   POST /clip           { mediaId, trackId, timelineStartMs, sourceInMs, sourceOutMs }
 *   POST /ai/edit        { instruction, mediaIds, constraints? }
 *   POST /ai/apply       { plan }
 *   POST /ai/edit-apply  { instruction, mediaIds, constraints? }  // plan + apply
 *   POST /undo
 *   POST /redo
 *
 * Configure direct providers with PHENOVA_PROVIDER_API_KEY and PHENOVA_PROVIDER_BASE_URL.
 *
 * Run:
 *   PHENOVA_PROVIDER_API_KEY=... npx ts-node services/api/src/engine-server.ts
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { PhenovaEditor } from '@phenova/engine';
import { createDirectProviderClientFromEnv, DirectProviderClient } from '@phenova/ai';
import { createStockRegistryFromEnv } from '@phenova/ai';
import { GenerationService } from '@phenova/ai';
import { MediaAsset } from '@phenova/core';

const PORT = Number(process.env.PHENOVA_ENGINE_PORT || 8788);
const DATA_DIR = process.env.PHENOVA_DATA_DIR || path.join(process.cwd(), 'data');
const PROJECT_FILE = path.join(DATA_DIR, 'current-project.json');

// ---------------------------------------------------------------------------
// Boot editor with a direct provider when key is present
// ---------------------------------------------------------------------------

let editor: PhenovaEditor;

try {
  const provider = createDirectProviderClientFromEnv();
  editor = new PhenovaEditor('Phenova Session', provider);
  console.log("Direct PHENOVA provider connected (" + (process.env.PHENOVA_PROVIDER_BASE_URL || "configured endpoint") + ")");
} catch {
  editor = new PhenovaEditor('Phenova Session');
  console.log('No PHENOVA_PROVIDER_API_KEY – AI endpoints require provider configuration');
  console.log('  export PHENOVA_PROVIDER_API_KEY=your_key');
}

const stockRegistry = createStockRegistryFromEnv();
console.log("Stock providers: " + (stockRegistry.list().map(function(p){return p.id;}).join(", ") || "(none - set PEXELS_API_KEY)"));

// Allow late binding of key via env reload is not needed;
// user can restart with the key. Optional: POST /ai/connect { apiKey }
try {
  if (fs.existsSync(PROJECT_FILE)) {
    const saved = JSON.parse(fs.readFileSync(PROJECT_FILE, 'utf8'));
    editor.loadProject(saved);
  }
} catch (err) {
  console.warn('Persisted project could not be loaded:', err);
}

function persistProject(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(PROJECT_FILE, JSON.stringify(editor.project, null, 2), 'utf8');
}

function ensureAI(): void {
  if (!editor.hasAI) {
    const key = process.env.PHENOVA_PROVIDER_API_KEY;
    if (key) {
      editor.setProviderClient(new DirectProviderClient(key, { baseUrl: process.env.PHENOVA_PROVIDER_BASE_URL }));
    }
  }
  if (!editor.hasAI) {
    throw new Error('Direct provider not configured. Set PHENOVA_PROVIDER_API_KEY and restart');
  }
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
}

function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Shared handler (used by gateway + standalone)
// ---------------------------------------------------------------------------

export function createEngineHandler(): (req: http.IncomingMessage, res: http.ServerResponse) => void {
  return async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  const rawUrl = req.url || '/';
  const url = rawUrl.split('?')[0];

  try {
    // Health
    if (req.method === 'GET' && url === '/health') {
      json(res, 200, {
        ok: true,
        hasAI: editor.hasAI,
        projectId: editor.project.meta.id,
        durationMs: editor.project.settings.durationMs,
        tracks: editor.project.tracks.length,
        media: Object.keys(editor.project.media).length,
      });
      return;
    }

    // Full project snapshot (Flutter pulls this after AI apply)
    if (req.method === 'GET' && url === '/project') {
      json(res, 200, editor.project);
      return;
    }

    // Add media
    if (req.method === 'POST' && url === '/media') {
      const body = await readBody(req);
      const media = body.media as MediaAsset;
      if (!media?.id) {
        json(res, 400, { error: 'media object with id required' });
        return;
      }
      editor.addMedia(media);
      persistProject();
      json(res, 200, { ok: true, mediaId: media.id });
      return;
    }

    // Add clip
    if (req.method === 'POST' && url === '/clip') {
      const body = await readBody(req);
      const { mediaId, trackId, timelineStartMs, sourceInMs, sourceOutMs } = body;
      if (!mediaId || !trackId) {
        json(res, 400, { error: 'mediaId and trackId required' });
        return;
      }
      const clipId = editor.addClip(
        mediaId,
        trackId,
        timelineStartMs ?? 0,
        sourceInMs ?? 0,
        sourceOutMs ?? 5000
      );
      persistProject();
      json(res, 200, { ok: true, clipId, project: editor.project });
      return;
    }

    // AI: plan only
    if (req.method === 'POST' && url === '/ai/edit') {
      ensureAI();
      const body = await readBody(req);
      const { instruction, mediaIds, constraints } = body;
      if (!instruction || !Array.isArray(mediaIds)) {
        json(res, 400, { error: 'instruction and mediaIds[] required' });
        return;
      }
      const plan = await editor.aiEdit(instruction, mediaIds, constraints || {});
      json(res, 200, { plan });
      return;
    }

    // AI: apply existing plan
    if (req.method === 'POST' && url === '/ai/apply') {
      const body = await readBody(req);
      if (!body.plan) {
        json(res, 400, { error: 'plan required' });
        return;
      }
      editor.applyPlan(body.plan);
      persistProject();
      json(res, 200, { ok: true, project: editor.project });
      return;
    }

    // AI: plan + apply in one shot
    if (req.method === 'POST' && url === '/ai/edit-apply') {
      ensureAI();
      const body = await readBody(req);
      const { instruction, mediaIds, constraints } = body;
      if (!instruction || !Array.isArray(mediaIds)) {
        json(res, 400, { error: 'instruction and mediaIds[] required' });
        return;
      }
      const plan = await editor.aiEditAndApply(
        instruction,
        mediaIds,
        constraints || {}
      );
      persistProject();
      json(res, 200, { plan, project: editor.project });
      return;
    }

    // Connect provider at runtime
    if (req.method === 'POST' && url === '/ai/connect') {
      const body = await readBody(req);
      if (!body.apiKey) {
        json(res, 400, { error: 'apiKey required' });
        return;
      }
      editor.setProviderClient(new DirectProviderClient(body.apiKey, { baseUrl: process.env.PHENOVA_PROVIDER_BASE_URL }));
      json(res, 200, { ok: true, hasAI: editor.hasAI });
      return;
    }

    // Undo / Redo
    if (req.method === 'POST' && url === '/undo') {
      editor.undo();
      persistProject();
      json(res, 200, { ok: true, project: editor.project });
      return;
    }
    if (req.method === 'POST' && url === '/redo') {
      editor.redo();
      persistProject();
      json(res, 200, { ok: true, project: editor.project });
      return;
    }


    // Stock search (licensed only)
    if (req.method === 'POST' && url === '/stock/search') {
      const body = await readBody(req);
      if (!body.query) {
        json(res, 400, { error: 'query required' });
        return;
      }
      const results = await stockRegistry.searchAll({
        query: body.query,
        type: body.type || 'video',
        orientation: body.orientation,
        page: body.page || 1,
        perPage: body.perPage || 12,
      });
      json(res, 200, { results });
      return;
    }

    // Generation – explicit opt-in
    if (req.method === 'POST' && url === '/generate/video') {
      ensureAI();
      const body = await readBody(req);
      if (!body.prompt) {
        json(res, 400, { error: 'prompt required' });
        return;
      }
      const provider = editor.getDirectProviderClient();
      if (!provider) {
        json(res, 503, { error: 'provider not connected' });
        return;
      }
      const gen = new GenerationService(provider);
      const job = await gen.generateVideo({
        prompt: body.prompt,
        durationMs: body.durationMs || 5000,
        aspectRatio: body.aspectRatio,
        style: body.style,
      });
      json(res, 200, { job });
      return;
    }

    if (req.method === 'POST' && url === '/generate/image') {
      ensureAI();
      const body = await readBody(req);
      if (!body.prompt) {
        json(res, 400, { error: 'prompt required' });
        return;
      }
      const provider = editor.getDirectProviderClient();
      if (!provider) {
        json(res, 503, { error: 'provider not connected' });
        return;
      }
      const gen = new GenerationService(provider);
      const job = await gen.generateImage({
        prompt: body.prompt,
        aspectRatio: body.aspectRatio,
        style: body.style,
      });
      // If URL returned, register as media immediately
      if (job.media) {
        editor.addMedia(job.media as any);
      }
      json(res, 200, { job, project: editor.project });
      return;
    }


    // --- Clip ops (UI dock / inspector) ---
    if (req.method === 'POST' && url === '/clip/speed') {
      const body = await readBody(req);
      if (!body.clipId || body.speed == null) {
        json(res, 400, { error: 'clipId and speed required' });
        return;
      }
      editor.setClipSpeed(body.clipId, Number(body.speed));
      persistProject();
      json(res, 200, { ok: true, project: editor.project });
      return;
    }

    if (req.method === 'POST' && url === '/clip/reverse') {
      const body = await readBody(req);
      if (!body.clipId) {
        json(res, 400, { error: 'clipId required' });
        return;
      }
      editor.reverseClip(body.clipId);
      persistProject();
      json(res, 200, { ok: true, project: editor.project });
      return;
    }

    if (req.method === 'POST' && url === '/clip/effect') {
      const body = await readBody(req);
      if (!body.clipId || !body.effectId) {
        json(res, 400, { error: 'clipId and effectId required' });
        return;
      }
      editor.applyEffect(body.clipId, body.effectId, body.params || {});
      persistProject();
      json(res, 200, { ok: true, project: editor.project });
      return;
    }

    if (req.method === 'POST' && url === '/clip/transition') {
      const body = await readBody(req);
      if (!body.clipId || !body.transitionId) {
        json(res, 400, { error: 'clipId and transitionId required' });
        return;
      }
      editor.applyTransition(body.clipId, body.transitionId, body.durationMs || 500, body.side || 'out');
      persistProject();
      json(res, 200, { ok: true, project: editor.project });
      return;
    }

    if (req.method === 'POST' && url === '/clip/split') {
      const body = await readBody(req);
      if (!body.clipId || body.atTimelineMs == null) {
        json(res, 400, { error: 'clipId and atTimelineMs required' });
        return;
      }
      editor.splitClip(body.clipId, Number(body.atTimelineMs));
      persistProject();
      json(res, 200, { ok: true, project: editor.project });
      return;
    }

    if (req.method === 'POST' && url === '/clip/mask') {
      const body = await readBody(req);
      if (!body.clipId || !body.maskType) {
        json(res, 400, { error: 'clipId and maskType required' });
        return;
      }
      editor.setMask(body.clipId, body.maskType, body.params || {});
      persistProject();
      json(res, 200, { ok: true, project: editor.project });
      return;
    }

    if (req.method === 'POST' && url === '/clip/track-motion') {
      const body = await readBody(req);
      if (!body.clipId) {
        json(res, 400, { error: 'clipId required' });
        return;
      }
      const result = await editor.trackMotion(body.clipId);
      persistProject();
      json(res, 200, { ok: true, result, project: editor.project });
      return;
    }

    if (req.method === 'POST' && url === '/clip/bg-remove') {
      const body = await readBody(req);
      if (!body.clipId) {
        json(res, 400, { error: 'clipId required' });
        return;
      }
      await editor.removeBackground(body.clipId);
      persistProject();
      json(res, 200, { ok: true, project: editor.project });
      return;
    }

    if (req.method === 'POST' && url === '/text') {
      const body = await readBody(req);
      editor.addTextOverlay(body.text || 'Text', body.timelineStartMs || 0, body.durationMs || 3000);
      persistProject();
      json(res, 200, { ok: true, project: editor.project });
      return;
    }

    if (req.method === 'POST' && url === '/captions/auto') {
      const body = await readBody(req);
      const result = await editor.autoCaptions(body.mediaId);
      persistProject();
      json(res, 200, { ok: true, result, project: editor.project });
      return;
    }

    // Export
    if (req.method === 'POST' && url === '/export') {
      const body = await readBody(req);
      const { FFmpegRenderer } = await import('@phenova/render');
      const renderer = new FFmpegRenderer();
      const outputPath = body.outputPath || ("/tmp/phenova-export-" + Date.now() + ".mp4");
      const useFilter = body.useFilterComplex !== false;
      if (useFilter) {
        await renderer.exportWithFilterComplex(editor.project, {
          outputPath,
          quality: body.quality || 'high',
        });
      } else {
        await renderer.exportProject(editor.project, {
          outputPath,
          quality: body.quality || 'high',
        });
      }
      json(res, 200, { ok: true, outputPath });
      return;
    }



    // Cloud-style project sync (in-memory by default; swap store for real cloud)
    if (req.method === 'GET' && url === '/projects') {
      // list – single session project for now
      json(res, 200, [{
        id: editor.project.meta.id,
        name: editor.project.meta.name,
        updatedAt: editor.project.meta.updatedAt,
      }]);
      return;
    }

    if (req.method === 'GET' && url === '/projects/current') {
      json(res, 200, {
        version: editor.project.meta.version,
        schemaVersion: editor.project.meta.schemaVersion,
        project: editor.project,
        updatedAt: editor.project.meta.updatedAt,
      });
      return;
    }

    if (req.method === 'PUT' && url === '/projects/current') {
      const body = await readBody(req);
      const project = body.project;
      if (!project?.meta?.id || !Array.isArray(project.tracks) || !project.media) {
        json(res, 400, { error: 'Valid project snapshot required' });
        return;
      }
      editor.loadProject(project);
      persistProject();
      json(res, 200, { ok: true, project: editor.project });
      return;
    }

    if (req.method === 'POST' && url === '/auth/logout') {
      json(res, 200, { ok: true });
      return;
    }

    // --- Templates ---
    if (req.method === 'GET' && url === '/templates') {
      const { listTemplates } = await import('./services/templates.js');
      json(res, 200, { templates: listTemplates() });
      return;
    }
    if (req.method === 'POST' && url === '/templates/apply') {
      const body = await readBody(req);
      const { applyTemplate } = await import('./services/templates.js');
      const plan = applyTemplate(body.templateId || 'cinematic', body.mediaIds || []);
      if (body.apply !== false) {
        try {
          // Prefer applyPlan when plan matches EditPlan shape; else store as marker effect
          if (plan && (plan as any).steps) {
            // Lightweight apply: place text / effects from steps without full AI schema
            for (const step of (plan as any).steps as any[]) {
              if (step.op === 'text') {
                editor.addTextOverlay(step.text || 'Title', step.timelineStartMs || 0, step.durationMs || 3000);
              } else if (step.op === 'effect_global') {
                // skip global without clip id
              }
            }
          }
          persistProject();
        } catch (e: any) {
          json(res, 200, { ok: true, plan, warning: e.message, project: editor.project });
          return;
        }
      }
      json(res, 200, { ok: true, plan, project: editor.project });
      return;
    }

    // --- AutoCut ---
    if (req.method === 'POST' && url === '/autocut') {
      const body = await readBody(req);
      const { autoCut } = await import('./services/autocut.js');
      const result = await autoCut({
        mediaPath: body.mediaPath,
        mediaId: body.mediaId,
        targetDurationMs: body.targetDurationMs,
        sensitivity: body.sensitivity,
      });
      json(res, 200, { ok: true, ...result });
      return;
    }

    // --- ASR / captions ---
    if (req.method === 'POST' && url === '/asr' || (req.method === 'POST' && url === '/captions/auto')) {
      const body = await readBody(req);
      const { transcribe } = await import('./services/asr.js');
      const result = await transcribe({
        mediaPath: body.mediaPath,
        mediaId: body.mediaId,
        language: body.language,
      });
      if (result.captions?.length) {
        for (const cap of result.captions) {
          try { editor.addCaption(cap as any); } catch (_) {}
        }
        persistProject();
      }
      json(res, 200, { ok: true, ...result, project: editor.project });
      return;
    }

    // --- Lightweight auth (session token; full auth via /api/v1 on FastAPI through gateway) ---
    if (req.method === 'POST' && url === '/auth/login') {
      const body = await readBody(req);
      const email = body.email || 'creator@phenova.local';
      const token = Buffer.from(JSON.stringify({ email, exp: Date.now() + 7 * 864e5 })).toString('base64url');
      json(res, 200, {
        ok: true,
        token,
        user: { email, name: body.name || email.split('@')[0], plan: 'pro' },
      });
      return;
    }
    if (req.method === 'GET' && url === '/auth/me') {
      const auth = req.headers['authorization'] || '';
      if (!auth.startsWith('Bearer ')) {
        json(res, 401, { error: 'Unauthorized' });
        return;
      }
      try {
        const payload = JSON.parse(Buffer.from(auth.slice(7), 'base64url').toString());
        json(res, 200, { user: { email: payload.email, name: payload.email?.split('@')[0], plan: 'pro' } });
      } catch {
        json(res, 401, { error: 'Invalid token' });
      }
      return;
    }
    if (req.method === 'GET' && url === '/entitlements') {
      json(res, 200, {
        plan: 'pro',
        features: ['4k_export', 'ai_editor', 'masks', 'motion_track', 'bg_remove', 'autocut', 'asr'],
        credits: { ai: 1000, export: 999 },
      });
      return;
    }


    // --- Proxy / filmstrip / scrub (smooth timeline) ---
    if (req.method === 'POST' && url === '/proxy/ensure') {
      const body = await readBody(req);
      const { ProxyManager } = await import('@phenova/render');
      const cacheDir = process.env.PHENOVA_PROXY_DIR || path.join(DATA_DIR, 'proxies');
      const pm = new ProxyManager({ cacheDir });
      const result = await pm.ensureProxy(body.mediaPath, body.mediaId || body.mediaPath, {
        filmstrip: body.filmstrip !== false,
      });
      json(res, 200, result);
      return;
    }
    if (req.method === 'POST' && url === '/proxy/ensure-batch') {
      const body = await readBody(req);
      const { ProxyManager } = await import('@phenova/render');
      const cacheDir = process.env.PHENOVA_PROXY_DIR || path.join(DATA_DIR, 'proxies');
      const pm = new ProxyManager({ cacheDir, concurrency: 2 });
      const results = await pm.ensureProxies(body.items || [], { filmstrip: !!body.filmstrip });
      json(res, 200, { results });
      return;
    }
    if (req.method === 'GET' && url.startsWith('/proxy/scrub')) {
      const u = new URL(req.url || '', 'http://127.0.0.1');
      const mediaId = u.searchParams.get('mediaId') || '';
      const timeMs = Number(u.searchParams.get('timeMs') || 0);
      const { ProxyManager } = await import('@phenova/render');
      const cacheDir = process.env.PHENOVA_PROXY_DIR || path.join(DATA_DIR, 'proxies');
      const pm = new ProxyManager({ cacheDir });
      try {
        const framePath = await pm.scrubFrame(mediaId, timeMs);
        json(res, 200, { path: framePath, mediaId, timeMs });
      } catch (e: any) {
        json(res, 404, { error: e.message });
      }
      return;
    }
    if (req.method === 'POST' && url === '/matting/remove-bg') {
      const body = await readBody(req);
      const { removeBackground } = await import('@phenova/render');
      const out = body.outputPath || path.join(DATA_DIR, `matte_${Date.now()}.mov`);
      const result = await removeBackground({
        inputPath: body.inputPath || body.mediaPath,
        outputPath: out,
        keyColor: body.keyColor,
        preferMl: body.preferMl !== false,
        model: body.model,
      });
      json(res, 200, result);
      return;
    }


    json(res, 404, { error: 'Not found' });
  } catch (err: any) {
    const status = err.message?.includes('provider') ? 503 : 500;
    json(res, status, { error: err.message || String(err) });
  }
  };
}

/** Standalone listen (when not using gateway) */
export function startEngineServer(port = PORT): http.Server {
  const handler = createEngineHandler();
  const server = http.createServer(handler);
  server.listen(port, () => {
    console.log("Phenova engine bridge on http://127.0.0.1:" + port);
    console.log('Endpoints: /health /project /clip/* /ai/* /templates /autocut /asr /export /auth/*');
  });
  return server;
}

// Auto-start when run directly
const isMain = typeof require !== 'undefined' && require.main === module
  || process.argv[1]?.includes('engine-server');
if (isMain) {
  startEngineServer();
}


// PHENOVA_DIRECTOR_CLARIFY_PROXY
// Route contract for the engine gateway. The host application should register
// POST /director/clarify and forward JSON to the FastAPI director service.
// Backend URL is configurable so Android/device builds do not depend on localhost.
export function directorClarifyTarget(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/director/clarify`;
}
