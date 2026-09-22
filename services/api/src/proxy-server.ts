/**
 * Lightweight local proxy service.
 *
 * POST /proxy  { mediaPath, mediaId } → { proxyPath, thumbnailPath }
 * GET  /health
 *
 * Run:
 *   npx ts-node services/api/src/proxy-server.ts
 *
 * Default port 8787. Flutter / engine can call this to generate proxies.
 */

import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import { ProxyManager } from '@phenova/render';

const PORT = Number(process.env.PHENOVA_PROXY_PORT || 8787);
const CACHE_DIR = process.env.PHENOVA_PROXY_CACHE || path.join(process.cwd(), 'proxies');

const manager = new ProxyManager({ cacheDir: CACHE_DIR });

const server = http.createServer(async (req, res) => {
  // CORS for local Flutter / web
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, cacheDir: CACHE_DIR }));
    return;
  }

  if (req.method === 'POST' && req.url === '/proxy') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const { mediaPath, mediaId } = JSON.parse(body);
        if (!mediaPath || !mediaId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'mediaPath and mediaId required' }));
          return;
        }
        if (!fs.existsSync(mediaPath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `File not found: ${mediaPath}` }));
          return;
        }

        const result = await manager.ensureProxy(mediaPath, mediaId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`Phenova proxy service listening on http://127.0.0.1:${PORT}`);
  console.log(`Cache directory: ${CACHE_DIR}`);
});
