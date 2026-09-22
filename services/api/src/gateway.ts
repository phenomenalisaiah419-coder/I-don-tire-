/**
 * PHENOVA Unified Gateway — single client base URL (default :8788)
 *
 *  - Engine paths  → in-process PhenovaEditor handler
 *  - /api/v1/*     → proxy to FastAPI (PHENOVA_FASTAPI_URL, default :8000)
 *
 * Flutter should only use http://127.0.0.1:8788
 *
 *   PHENOVA_GATEWAY_PORT=8788
 *   PHENOVA_FASTAPI_URL=http://127.0.0.1:8000
 *   PHENOVA_PROVIDER_API_KEY=...
 *
 * Run: npx tsx services/api/src/gateway.ts
 */

import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { createEngineHandler } from './engine-server';

const GATEWAY_PORT = Number(process.env.PHENOVA_GATEWAY_PORT || process.env.PHENOVA_ENGINE_PORT || 8788);
const FASTAPI_URL = (process.env.PHENOVA_FASTAPI_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

const ENGINE_PREFIXES = [
  '/health',
  '/gateway/health',
  '/project',
  '/media',
  '/clip',
  '/ai/',
  '/undo',
  '/redo',
  '/export',
  '/stock/',
  '/generate/',
  '/text',
  '/captions/',
  '/templates',
  '/autocut',
  '/asr',
  '/projects',
  '/auth/',
  '/entitlements',
];

function isEnginePath(urlPath: string): boolean {
  if (urlPath.startsWith('/api/v1')) return false;
  return ENGINE_PREFIXES.some((p) => urlPath === p || urlPath.startsWith(p));
}

function proxyToFastApi(req: http.IncomingMessage, res: http.ServerResponse, urlPath: string): void {
  const qs = req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const target = new URL(urlPath + qs, FASTAPI_URL);
  const isHttps = target.protocol === 'https:';
  const lib = isHttps ? https : http;
  const headers: http.OutgoingHttpHeaders = { ...req.headers, host: target.host };
  delete headers['connection'];

  const proxyReq = lib.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (isHttps ? 443 : 80),
      path: target.pathname + target.search,
      method: req.method,
      headers,
      timeout: 120_000,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, {
        ...proxyRes.headers,
        'access-control-allow-origin': '*',
      });
      proxyRes.pipe(res);
    },
  );

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(
      JSON.stringify({
        error: 'FastAPI unreachable',
        detail: String(err.message || err),
        hint: 'Start backend: cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000',
        fastapi: FASTAPI_URL,
      }),
    );
  });

  req.pipe(proxyReq);
}

async function main(): Promise<void> {
  const engineHandler = createEngineHandler();

  const server = http.createServer((req, res) => {
    const urlPath = (req.url || '/').split('?')[0];

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      });
      res.end();
      return;
    }

    if (req.method === 'GET' && urlPath === '/gateway/health') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(
        JSON.stringify({
          ok: true,
          service: 'phenova-gateway',
          engine: true,
          fastapi: FASTAPI_URL,
          port: GATEWAY_PORT,
          routes: {
            engine: ENGINE_PREFIXES,
            fastapi: '/api/v1/*',
          },
        }),
      );
      return;
    }

    if (isEnginePath(urlPath)) {
      engineHandler(req, res);
      return;
    }

    proxyToFastApi(req, res, urlPath);
  });

  server.listen(GATEWAY_PORT, () => {
    console.log(`[phenova-gateway] http://127.0.0.1:${GATEWAY_PORT}`);
    console.log(`  Engine: ${ENGINE_PREFIXES.join(', ')}`);
    console.log(`  FastAPI proxy: ${FASTAPI_URL}/api/v1/*`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
