/**
 * CLI: generate proxy + thumbnail for a media file.
 *
 * Usage:
 *   npx ts-node scripts/generate-proxy.ts <mediaPath> <mediaId> [cacheDir]
 *
 * Example:
 *   npx ts-node scripts/generate-proxy.ts ./clip.mp4 abc123 ./proxies
 */

import * as path from 'path';
import { ProxyManager } from '../packages/render/src/proxy';

async function main() {
  const mediaPath = process.argv[2];
  const mediaId = process.argv[3] || path.basename(mediaPath, path.extname(mediaPath));
  const cacheDir = process.argv[4] || path.join(process.cwd(), 'proxies');

  if (!mediaPath) {
    console.error('Usage: generate-proxy.ts <mediaPath> [mediaId] [cacheDir]');
    process.exit(1);
  }

  const manager = new ProxyManager({ cacheDir });
  console.log(`Generating proxy for ${mediaPath} …`);
  const result = await manager.ensureProxy(mediaPath, mediaId);

  console.log(JSON.stringify(result, null, 2));
  console.log(result.alreadyExisted ? '(cached)' : '(generated)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
