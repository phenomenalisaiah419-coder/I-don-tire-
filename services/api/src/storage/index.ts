/**
 * Object storage abstraction (spec §13).
 *
 * LocalStorageBackend for dev/CI, S3-compatible backend contract for
 * production. Enforces: ownership, storage quotas, content validation and
 * path-traversal protection. Supports resumable/chunked uploads.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { DataStore } from '../db';
import { ServerConfig } from '../config';
import { ApiError } from '../auth';
import { validateUpload, probe } from '@phenova/render';

export interface StoredObject {
  key: string;
  absolutePath: string;
  sizeBytes: number;
  sha256: string;
}

/** Prevent path traversal: keys are canonicalized under the user prefix. */
export function safeKey(userId: string, name: string): string {
  const clean = path.posix.normalize(name).replace(/^(\.\.(\/|\\|$))+/, '').replace(/^\/+/, '');
  if (clean.includes('..') || path.isAbsolute(clean)) {
    throw new ApiError(400, 'Invalid storage key');
  }
  return `${userId}/${clean}`;
}

export class StorageService {
  constructor(
    private db: DataStore,
    private config: ServerConfig,
  ) {
    fs.mkdirSync(config.dataDir, { recursive: true });
  }

  private resolve(key: string): string {
    const root = path.resolve(this.config.dataDir);
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep)) {
      throw new ApiError(400, 'Invalid storage key (path traversal blocked)');
    }
    return full;
  }

  storageLimitBytes(userId: string, plan: 'free' | 'premium'): number {
    return plan === 'premium' ? this.config.premiumStorageBytes : this.config.freeStorageBytes;
  }

  assertQuota(userId: string, plan: 'free' | 'premium', incomingBytes: number): void {
    const used = this.db.storageUsedBytes(userId);
    const limit = this.storageLimitBytes(userId, plan);
    if (used + incomingBytes > limit) {
      throw new ApiError(402, `Storage quota exceeded (${Math.round(used / 1e6)}MB of ${Math.round(limit / 1e6)}MB used)`, 'QUOTA_EXCEEDED');
    }
  }

  // ------------------------------------------------------------------
  // Chunked / resumable upload (spec §13)
  // ------------------------------------------------------------------

  beginUpload(userId: string, filename: string, totalBytes: number, plan: 'free' | 'premium'): { uploadId: string; chunkBytes: number } {
    if (!filename || totalBytes <= 0) throw new ApiError(400, 'filename and positive totalBytes required');
    if (totalBytes > this.config.maxUploadBytes) {
      throw new ApiError(413, `File exceeds maximum upload size of ${Math.round(this.config.maxUploadBytes / 1e9)}GB`);
    }
    this.assertQuota(userId, plan, totalBytes);
    const uploadId = uuidv4();
    const chunkDir = path.join(this.config.dataDir, '_uploads', uploadId);
    fs.mkdirSync(chunkDir, { recursive: true });
    this.db.insertUpload({ id: uploadId, user_id: userId, filename: path.basename(filename), total_bytes: totalBytes, chunk_dir: chunkDir });
    return { uploadId, chunkBytes: this.config.uploadChunkBytes };
  }

  /** Append one chunk. Chunks must arrive in order (client retries safely). */
  uploadChunk(userId: string, uploadId: string, chunkIndex: number, data: Buffer): { receivedBytes: number; complete: boolean } {
    const up = this.db.getUpload(uploadId);
    if (!up || up.user_id !== userId) throw new ApiError(404, 'Upload not found');
    if (up.state !== 'receiving') throw new ApiError(409, `Upload is ${up.state}`);
    const chunkPath = path.join(up.chunk_dir, `${String(chunkIndex).padStart(8, '0')}.part`);
    if (!fs.existsSync(chunkPath)) {
      fs.writeFileSync(chunkPath, data);
    }
    const received = fs.readdirSync(up.chunk_dir)
      .filter(f => f.endsWith('.part'))
      .reduce((sum, f) => sum + fs.statSync(path.join(up.chunk_dir, f)).size, 0);
    this.db.setUploadProgress(uploadId, received);
    return { receivedBytes: received, complete: received >= up.total_bytes };
  }

  /** Finalize: concatenate chunks, validate content by magic bytes, store. */
  async completeUpload(userId: string, uploadId: string): Promise<{ object: StoredObject; detectedKind: 'video' | 'audio' | 'image'; mime: string }> {
    const up = this.db.getUpload(uploadId);
    if (!up || up.user_id !== userId) throw new ApiError(404, 'Upload not found');
    if (up.state !== 'receiving') throw new ApiError(409, `Upload is ${up.state}`);

    const chunks = fs.readdirSync(up.chunk_dir).filter(f => f.endsWith('.part')).sort();
    const assembled = path.join(up.chunk_dir, 'assembled');
    const out = fs.createWriteStream(assembled);
    for (const c of chunks) {
      const buf = fs.readFileSync(path.join(up.chunk_dir, c));
      await new Promise<void>((res, rej) => out.write(buf, e => (e ? rej(e) : res())));
    }
    await new Promise<void>((res) => out.end(res));

    const stat = fs.statSync(assembled);
    if (stat.size !== up.total_bytes) {
      this.db.setUploadState(uploadId, 'aborted');
      throw new ApiError(400, `Size mismatch: expected ${up.total_bytes}, got ${stat.size}`);
    }

    let detected: { kind: 'video' | 'audio' | 'image'; mime: string };
    try {
      detected = validateUpload(assembled, this.config.maxUploadBytes);
    } catch (e) {
      this.db.setUploadState(uploadId, 'aborted');
      throw new ApiError(400, (e as Error).message, 'CONTENT_INVALID');
    }
    const sha = crypto.createHash('sha256').update(fs.readFileSync(assembled)).digest('hex');

    const ext = path.extname(up.filename).toLowerCase() || defaultExt(detected.mime);
    const key = safeKey(userId, `media/${uuidv4()}${ext}`);
    const dest = this.resolve(key);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.renameSync(assembled, dest);
    fs.rmSync(up.chunk_dir, { recursive: true, force: true });
    this.db.setUploadState(uploadId, 'completed');

    return {
      object: { key, absolutePath: dest, sizeBytes: stat.size, sha256: sha },
      detectedKind: detected.kind,
      mime: detected.mime,
    };
  }

  abortUpload(userId: string, uploadId: string): void {
    const up = this.db.getUpload(uploadId);
    if (!up || up.user_id !== userId) throw new ApiError(404, 'Upload not found');
    fs.rmSync(up.chunk_dir, { recursive: true, force: true });
    this.db.setUploadState(uploadId, 'aborted');
  }

  /** Deterministic cleanup of stale uploads (spec §13: secure temp media). */
  cleanupStaleUploads(maxAgeMs = 24 * 3600_000): number {
    const dir = path.join(this.config.dataDir, '_uploads');
    if (!fs.existsSync(dir)) return 0;
    let removed = 0;
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      try {
        const stat = fs.statSync(full);
        if (Date.now() - stat.mtimeMs > maxAgeMs) {
          fs.rmSync(full, { recursive: true, force: true });
          removed++;
        }
      } catch { /* entry may vanish concurrently */ }
    }
    return removed;
  }

  /** Write an already-local file (e.g. stock download) into user storage. */
  async storeLocalFile(userId: string, sourcePath: string, filename: string, plan: 'free' | 'premium'): Promise<{ object: StoredObject; detectedKind: 'video' | 'audio' | 'image'; mime: string }> {
    const stat = fs.statSync(sourcePath);
    this.assertQuota(userId, plan, stat.size);
    let detected: { kind: 'video' | 'audio' | 'image'; mime: string };
    try {
      detected = validateUpload(sourcePath, this.config.maxUploadBytes);
    } catch (e) {
      throw new ApiError(400, (e as Error).message, 'CONTENT_INVALID');
    }
    const sha = crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex');
    const ext = path.extname(filename).toLowerCase() || defaultExt(detected.mime);
    const key = safeKey(userId, `media/${uuidv4()}${ext}`);
    const dest = this.resolve(key);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(sourcePath, dest);
    return { object: { key, absolutePath: dest, sizeBytes: stat.size, sha256: sha }, detectedKind: detected.kind, mime: detected.mime };
  }

  async registerMediaFromFile(params: {
    userId: string;
    projectId?: string;
    absolutePath: string;
    kind: 'user' | 'licensed' | 'generated';
    sourceJson: Record<string, unknown>;
    type: 'video' | 'audio' | 'image';
  }) {
    const p = await probe(params.absolutePath, this.config.ffprobePath).catch(() => null);
    const stat = fs.statSync(params.absolutePath);
    const id = uuidv4();
    this.db.insertMedia({
      id,
      user_id: params.userId,
      project_id: params.projectId ?? null,
      kind: params.kind,
      source_json: JSON.stringify(params.sourceJson),
      type: params.type,
      path: params.absolutePath,
      size_bytes: stat.size,
      duration_ms: p?.durationMs ?? 0,
      width: p?.width ?? null,
      height: p?.height ?? null,
      fps: p?.fps ?? null,
      codec: p?.codec ?? null,
      has_audio: p?.hasAudio ? 1 : 0,
      analysis_json: null,
      created_at: new Date().toISOString(),
    });
    return { id, probe: p };
  }
}

function defaultExt(mime: string): string {
  if (mime.includes('mp4')) return '.mp4';
  if (mime.includes('webm')) return '.webm';
  if (mime.includes('jpeg')) return '.jpg';
  if (mime.includes('png')) return '.png';
  if (mime.includes('mpeg')) return '.mp3';
  if (mime.includes('wav')) return '.wav';
  if (mime.includes('ogg')) return '.ogg';
  return '.bin';
}
