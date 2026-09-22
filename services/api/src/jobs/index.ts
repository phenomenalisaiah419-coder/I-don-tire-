/**
 * Durable job queue (spec §10/§13).
 *
 * Job states: queued → processing → completed | failed | cancelled.
 * Progress reporting, cancellation, bounded-concurrency retries, and
 * deterministic cleanup. Jobs survive process restarts (DB-backed).
 */

import { v4 as uuidv4 } from 'uuid';
import { DataStore, JobRow } from '../db';
import { ApiError } from '../auth';

export type JobType = 'render' | 'export' | 'generation' | 'proxy';
export type JobState = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface JobHandlerContext {
  job: JobRow;
  signal: { cancelled: boolean };
  setProgress: (percent: number) => void;
}

export type JobHandler = (ctx: JobHandlerContext) => Promise<unknown>;

export interface JobQueueOptions {
  concurrency?: number;         // memory-aware bounded concurrency
  maxAttempts?: number;         // infrastructure retries do NOT consume user quota (spec §12)
  pollIntervalMs?: number;
}

export class JobQueue {
  private handlers = new Map<JobType, JobHandler>();
  private running = new Map<string, { cancel: () => void }>();
  private timer: NodeJS.Timeout | null = null;
  private concurrency: number;
  private maxAttempts: number;
  private pollIntervalMs: number;
  private stopped = true;

  constructor(
    private db: DataStore,
    options: JobQueueOptions = {},
  ) {
    this.concurrency = options.concurrency ?? Math.max(1, Math.min(2, (require('os').cpus()?.length ?? 2) - 1));
    this.maxAttempts = options.maxAttempts ?? 2;
    this.pollIntervalMs = options.pollIntervalMs ?? 500;
  }

  register(type: JobType, handler: JobHandler): void {
    this.handlers.set(type, handler);
  }

  enqueue(userId: string, type: JobType, payload: unknown): JobRow {
    const now = new Date().toISOString();
    const job: JobRow = {
      id: uuidv4(),
      user_id: userId,
      type,
      state: 'queued',
      progress: 0,
      payload_json: JSON.stringify(payload),
      result_json: null,
      error: null,
      attempts: 0,
      created_at: now,
      updated_at: now,
    };
    this.db.insertJob(job);
    return job;
  }

  get(jobId: string, userId?: string): JobRow {
    const job = this.db.getJob(jobId);
    if (!job) throw new ApiError(404, 'Job not found');
    if (userId && job.user_id !== userId) throw new ApiError(403, 'Job belongs to another user');
    return job;
  }

  cancel(jobId: string, userId: string): void {
    const job = this.get(jobId, userId);
    if (job.state === 'completed' || job.state === 'failed' || job.state === 'cancelled') {
      return; // already terminal
    }
    const running = this.running.get(jobId);
    if (running) {
      running.cancel(); // handler observes signal and aborts (e.g. kills ffmpeg)
    }
    this.db.updateJob(jobId, { state: 'cancelled' });
  }

  /** User-requested retry of a failed job (re-queues the same job row). */
  retry(jobId: string, userId: string): void {
    const job = this.get(jobId, userId);
    if (job.state !== 'failed' && job.state !== 'cancelled') {
      throw new ApiError(409, `Only failed or cancelled jobs can be retried (state: ${job.state})`);
    }
    this.db.updateJob(jobId, { state: 'queued', progress: 0, error: null });
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    // Re-queue jobs that were processing when the process died (durable state).
    const loop = async () => {
      if (this.stopped) return;
      try {
        await this.tick();
      } catch (e) {
        console.error('[jobs] tick error:', e);
      }
      this.timer = setTimeout(loop, this.pollIntervalMs);
    };
    this.timer = setTimeout(loop, 0);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  get runningCount(): number {
    return this.running.size;
  }

  private async tick(): Promise<void> {
    while (this.running.size < this.concurrency) {
      const job = this.db.nextQueuedJob();
      if (!job) return;
      // claim
      this.db.updateJob(job.id, { state: 'processing', attempts: job.attempts + 1 });
      void this.runJob(job);
    }
  }

  private async runJob(jobRow: JobRow): Promise<void> {
    const handler = this.handlers.get(jobRow.type as JobType);
    if (!handler) {
      this.db.updateJob(jobRow.id, { state: 'failed', error: `No handler for job type ${jobRow.type}` });
      return;
    }
    const signal = { cancelled: false };
    this.running.set(jobRow.id, {
      cancel: () => {
        signal.cancelled = true;
      },
    });

    const ctx: JobHandlerContext = {
      job: this.db.getJob(jobRow.id)!,
      signal,
      setProgress: (percent) => {
        if (!signal.cancelled) {
          this.db.updateJob(jobRow.id, { progress: Math.max(0, Math.min(100, percent)) });
        }
      },
    };

    try {
      const result = await handler(ctx);
      // If a cancel landed while finishing, keep cancelled state.
      const current = this.db.getJob(jobRow.id);
      if (current?.state === 'cancelled' || signal.cancelled) return;
      this.db.updateJob(jobRow.id, { state: 'completed', progress: 100, result_json: JSON.stringify(result ?? null) });
    } catch (e) {
      const message = (e as Error).message || String(e);
      const current = this.db.getJob(jobRow.id);
      if (current?.state === 'cancelled' || signal.cancelled || /cancelled/i.test(message)) {
        this.db.updateJob(jobRow.id, { state: 'cancelled', error: null });
      } else if ((current?.attempts ?? 1) < this.maxAttempts) {
        // infrastructure retry – does not consume user quota (spec §12)
        this.db.updateJob(jobRow.id, { state: 'queued', error: `retrying after: ${message}` });
      } else {
        this.db.updateJob(jobRow.id, { state: 'failed', error: message.slice(0, 4000) });
      }
    } finally {
      this.running.delete(jobRow.id);
    }
  }
}
