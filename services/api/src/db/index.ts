/**
 * Database layer (spec §13: durable storage with migrations).
 *
 * Development/CI: SQLite via node:sqlite (zero-dependency, durable).
 * Production: set PHENOVA_DB_BACKEND=postgres and provide DATABASE_URL;
 * the same migration set is applied (SQL is standard; see migrations dir).
 *
 * The whole server talks to this typed DataStore – never raw SQL scattered.
 */

import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  created_at: string;
  deleted_at: string | null;
}

export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  data: string;            // canonical Project JSON
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface MediaRow {
  id: string;
  user_id: string;
  project_id: string | null;
  kind: string;            // user | licensed | generated
  source_json: string;
  type: string;            // video | audio | image
  path: string;
  size_bytes: number;
  duration_ms: number;
  width: number | null;
  height: number | null;
  fps: number | null;
  codec: string | null;
  has_audio: number;
  analysis_json: string | null;
  created_at: string;
}

export interface JobRow {
  id: string;
  user_id: string;
  type: string;            // render | export | generation | proxy
  state: string;           // queued | processing | completed | failed | cancelled
  progress: number;
  payload_json: string;
  result_json: string | null;
  error: string | null;
  attempts: number;
  created_at: string;
  updated_at: string;
}

export interface QuotaRow {
  user_id: string;
  date_utc: string;
  pro_edits_used: number;
  basic_edits_used: number;
}

export interface CorrectionRow {
  job_id: string;
  user_id: string;
  accepted_count: number;
}

export interface SubscriptionRow {
  user_id: string;
  plan: string;            // free | premium
  status: string;          // active | expired | cancelled
  started_at: string;
  expires_at: string | null;
  verified_by: string;     // payment verification reference
}

export interface PlanConfigRow {
  key: string;
  value_json: string;
}

export const MIGRATIONS: Array<{ id: number; name: string; sql: string }> = [
  {
    id: 1,
    name: 'initial_schema',
    sql: `
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        deleted_at TEXT
      );
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        token_hash TEXT UNIQUE NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked_at TEXT
      );
      CREATE INDEX idx_sessions_user ON sessions(user_id);
      CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        name TEXT NOT NULL,
        data TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );
      CREATE INDEX idx_projects_user ON projects(user_id, deleted_at);
      CREATE TABLE media (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        project_id TEXT,
        kind TEXT NOT NULL CHECK (kind IN ('user','licensed','generated')),
        source_json TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('video','audio','image')),
        path TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        width INTEGER, height INTEGER, fps REAL, codec TEXT,
        has_audio INTEGER NOT NULL DEFAULT 0,
        analysis_json TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX idx_media_user ON media(user_id);
      CREATE TABLE jobs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        type TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('queued','processing','completed','failed','cancelled')),
        progress REAL NOT NULL DEFAULT 0,
        payload_json TEXT NOT NULL,
        result_json TEXT,
        error TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_jobs_user ON jobs(user_id, state);
      CREATE TABLE quotas (
        user_id TEXT NOT NULL,
        date_utc TEXT NOT NULL,
        pro_edits_used INTEGER NOT NULL DEFAULT 0,
        basic_edits_used INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, date_utc)
      );
      CREATE TABLE corrections (
        job_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        accepted_count INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE subscriptions (
        user_id TEXT PRIMARY KEY,
        plan TEXT NOT NULL CHECK (plan IN ('free','premium')),
        status TEXT NOT NULL CHECK (status IN ('active','expired','cancelled')),
        started_at TEXT NOT NULL,
        expires_at TEXT,
        verified_by TEXT NOT NULL
      );
      CREATE TABLE plan_config (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL
      );
      CREATE TABLE uploads (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        filename TEXT NOT NULL,
        total_bytes INTEGER NOT NULL,
        received_bytes INTEGER NOT NULL DEFAULT 0,
        state TEXT NOT NULL CHECK (state IN ('receiving','completed','aborted')),
        chunk_dir TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
];

export class DataStore {
  private db: DatabaseSync;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)`);
    const applied = new Set(
      (this.db.prepare('SELECT id FROM _migrations').all() as Array<{ id: number }>).map(r => r.id)
    );
    for (const m of MIGRATIONS) {
      if (applied.has(m.id)) continue;
      this.db.exec('BEGIN');
      try {
        this.db.exec(m.sql);
        this.db.prepare('INSERT INTO _migrations (id, name, applied_at) VALUES (?, ?, ?)')
          .run(m.id, m.name, new Date().toISOString());
        this.db.exec('COMMIT');
      } catch (e) {
        this.db.exec('ROLLBACK');
        throw e;
      }
    }
  }

  // ------------------------------------------------------------------ users
  createUser(u: UserRow): void {
    this.db.prepare(
      'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(u.id, u.email.toLowerCase(), u.password_hash, u.display_name, u.created_at);
  }

  getUserByEmail(email: string): UserRow | undefined {
    return this.db.prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL')
      .get(email.toLowerCase()) as UserRow | undefined;
  }

  getUser(id: string): UserRow | undefined {
    return this.db.prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL')
      .get(id) as UserRow | undefined;
  }

  // --------------------------------------------------------------- sessions
  createSession(s: SessionRow): void {
    this.db.prepare(
      'INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run(s.id, s.user_id, s.token_hash, s.created_at, s.expires_at);
  }

  getSessionByTokenHash(tokenHash: string): SessionRow | undefined {
    return this.db.prepare(
      'SELECT * FROM sessions WHERE token_hash = ? AND revoked_at IS NULL'
    ).get(tokenHash) as SessionRow | undefined;
  }

  revokeSession(tokenHash: string): void {
    this.db.prepare('UPDATE sessions SET revoked_at = ? WHERE token_hash = ?')
      .run(new Date().toISOString(), tokenHash);
  }

  revokeAllSessions(userId: string): void {
    this.db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL')
      .run(new Date().toISOString(), userId);
  }

  // --------------------------------------------------------------- projects
  upsertProject(p: ProjectRow): void {
    this.db.prepare(`
      INSERT INTO projects (id, user_id, name, data, version, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        data = excluded.data,
        version = excluded.version,
        updated_at = excluded.updated_at,
        deleted_at = NULL
    `).run(p.id, p.user_id, p.name, p.data, p.version, p.created_at, p.updated_at);
  }

  getProject(id: string): ProjectRow | undefined {
    return this.db.prepare('SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL')
      .get(id) as ProjectRow | undefined;
  }

  listProjects(userId: string): ProjectRow[] {
    return this.db.prepare(
      'SELECT * FROM projects WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC'
    ).all(userId) as unknown as ProjectRow[];
  }

  softDeleteProject(id: string): void {
    this.db.prepare('UPDATE projects SET deleted_at = ? WHERE id = ?')
      .run(new Date().toISOString(), id);
  }

  restoreProject(id: string): void {
    this.db.prepare('UPDATE projects SET deleted_at = NULL WHERE id = ?').run(id);
  }

  // ------------------------------------------------------------------ media
  insertMedia(m: MediaRow): void {
    this.db.prepare(`
      INSERT INTO media (id, user_id, project_id, kind, source_json, type, path, size_bytes,
        duration_ms, width, height, fps, codec, has_audio, analysis_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(m.id, m.user_id, m.project_id, m.kind, m.source_json, m.type, m.path, m.size_bytes,
      m.duration_ms, m.width, m.height, m.fps, m.codec, m.has_audio, m.analysis_json, m.created_at);
  }

  getMedia(id: string): MediaRow | undefined {
    return this.db.prepare('SELECT * FROM media WHERE id = ?').get(id) as MediaRow | undefined;
  }

  listMediaByUser(userId: string): MediaRow[] {
    return this.db.prepare('SELECT * FROM media WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as unknown as MediaRow[];
  }

  updateMediaAnalysis(id: string, analysisJson: string): void {
    this.db.prepare('UPDATE media SET analysis_json = ? WHERE id = ?').run(analysisJson, id);
  }

  storageUsedBytes(userId: string): number {
    const row = this.db.prepare('SELECT COALESCE(SUM(size_bytes), 0) AS total FROM media WHERE user_id = ?')
      .get(userId) as { total: number };
    return row.total;
  }

  // ------------------------------------------------------------------- jobs
  insertJob(j: JobRow): void {
    this.db.prepare(`
      INSERT INTO jobs (id, user_id, type, state, progress, payload_json, result_json, error, attempts, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(j.id, j.user_id, j.type, j.state, j.progress, j.payload_json, j.result_json, j.error,
      j.attempts, j.created_at, j.updated_at);
  }

  getJob(id: string): JobRow | undefined {
    return this.db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as JobRow | undefined;
  }

  updateJob(id: string, patch: Partial<Pick<JobRow, 'state' | 'progress' | 'result_json' | 'error' | 'attempts'>>): void {
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [k, v] of Object.entries(patch)) {
      fields.push(`${k} = ?`);
      values.push(v);
    }
    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);
    this.db.prepare(`UPDATE jobs SET ${fields.join(', ')} WHERE id = ?`).run(...(values as never[]));
  }

  listJobsByUser(userId: string, limit = 50): JobRow[] {
    return this.db.prepare('SELECT * FROM jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(userId, limit) as unknown as JobRow[];
  }

  nextQueuedJob(): JobRow | undefined {
    return this.db.prepare(
      `SELECT * FROM jobs WHERE state = 'queued' ORDER BY created_at ASC LIMIT 1`
    ).get() as JobRow | undefined;
  }

  // ----------------------------------------------------------------- quotas
  getQuota(userId: string, dateUtc: string): QuotaRow {
    const row = this.db.prepare('SELECT * FROM quotas WHERE user_id = ? AND date_utc = ?')
      .get(userId, dateUtc) as QuotaRow | undefined;
    if (row) return row;
    return { user_id: userId, date_utc: dateUtc, pro_edits_used: 0, basic_edits_used: 0 };
  }

  incrementQuota(userId: string, dateUtc: string, kind: 'pro' | 'basic'): void {
    this.db.prepare(`
      INSERT INTO quotas (user_id, date_utc, pro_edits_used, basic_edits_used)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, date_utc) DO UPDATE SET
        pro_edits_used = pro_edits_used + excluded.pro_edits_used,
        basic_edits_used = basic_edits_used + excluded.basic_edits_used
    `).run(userId, dateUtc, kind === 'pro' ? 1 : 0, kind === 'basic' ? 1 : 0);
  }

  // ------------------------------------------------------------ corrections
  getCorrections(jobId: string): CorrectionRow | undefined {
    return this.db.prepare('SELECT * FROM corrections WHERE job_id = ?').get(jobId) as CorrectionRow | undefined;
  }

  incrementCorrections(jobId: string, userId: string): number {
    this.db.prepare(`
      INSERT INTO corrections (job_id, user_id, accepted_count) VALUES (?, ?, 1)
      ON CONFLICT(job_id) DO UPDATE SET accepted_count = accepted_count + 1
    `).run(jobId, userId);
    return this.getCorrections(jobId)!.accepted_count;
  }

  // ---------------------------------------------------------- subscriptions
  getSubscription(userId: string): SubscriptionRow | undefined {
    return this.db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId) as SubscriptionRow | undefined;
  }

  upsertSubscription(s: SubscriptionRow): void {
    this.db.prepare(`
      INSERT INTO subscriptions (user_id, plan, status, started_at, expires_at, verified_by)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        plan = excluded.plan, status = excluded.status,
        started_at = excluded.started_at, expires_at = excluded.expires_at,
        verified_by = excluded.verified_by
    `).run(s.user_id, s.plan, s.status, s.started_at, s.expires_at, s.verified_by);
  }

  // ------------------------------------------------------------ plan config
  getPlanConfig(key: string): unknown | undefined {
    const row = this.db.prepare('SELECT value_json FROM plan_config WHERE key = ?').get(key) as
      { value_json: string } | undefined;
    return row ? JSON.parse(row.value_json) : undefined;
  }

  setPlanConfig(key: string, value: unknown): void {
    this.db.prepare(`
      INSERT INTO plan_config (key, value_json) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
    `).run(key, JSON.stringify(value));
  }

  // ---------------------------------------------------------------- uploads
  insertUpload(u: { id: string; user_id: string; filename: string; total_bytes: number; chunk_dir: string }): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO uploads (id, user_id, filename, total_bytes, received_bytes, state, chunk_dir, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, 'receiving', ?, ?, ?)
    `).run(u.id, u.user_id, u.filename, u.total_bytes, u.chunk_dir, now, now);
  }

  getUpload(id: string) {
    return this.db.prepare('SELECT * FROM uploads WHERE id = ?').get(id) as
      { id: string; user_id: string; filename: string; total_bytes: number; received_bytes: number; state: string; chunk_dir: string } | undefined;
  }

  setUploadProgress(id: string, received: number): void {
    this.db.prepare('UPDATE uploads SET received_bytes = ?, updated_at = ? WHERE id = ?')
      .run(received, new Date().toISOString(), id);
  }

  setUploadState(id: string, state: 'receiving' | 'completed' | 'aborted'): void {
    this.db.prepare('UPDATE uploads SET state = ?, updated_at = ? WHERE id = ?')
      .run(state, new Date().toISOString(), id);
  }

  close(): void {
    this.db.close();
  }
}
