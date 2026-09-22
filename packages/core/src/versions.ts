/**
 * Project Version Store
 *
 * Master Spec §7: "Operations are versioned and reversible. Retain the
 * latest 20 versions by default; configurable. Do not prune versions
 * required by active jobs."
 *
 * Snapshots are immutable Project states keyed by an incrementing version
 * number. Every accepted change (event batch) can create a snapshot;
 * the store prunes oldest non-pinned versions beyond the retention limit.
 */

import { Project, TimelineEvent } from './types';

export interface ProjectVersion {
  version: number;
  name?: string;
  createdAt: string;
  project: Project;
  /** event range covered by this snapshot */
  eventFrom: number;
  eventTo: number;
  /** origin of the change, for the AI edit log */
  origin: 'manual' | 'ai' | 'restore' | 'import';
  /** plans applied in this version (AI edit log, spec §4) */
  planIds: string[];
  /** pinned versions are never pruned (active render/export jobs) */
  pinned: boolean;
}

export interface VersionStoreOptions {
  retention?: number; // default 20 per spec
}

export class VersionStore {
  private versions: ProjectVersion[] = [];
  private retention: number;

  constructor(options: VersionStoreOptions = {}) {
    this.retention = options.retention ?? 20;
  }

  get size(): number {
    return this.versions.length;
  }

  get latest(): ProjectVersion | undefined {
    return this.versions[this.versions.length - 1];
  }

  snapshot(
    project: Project,
    eventRange: { from: number; to: number },
    origin: ProjectVersion['origin'],
    planIds: string[] = [],
    name?: string
  ): ProjectVersion {
    const version: ProjectVersion = {
      version: (this.latest?.version ?? 0) + 1,
      name,
      createdAt: new Date().toISOString(),
      project: structuredClone(project),
      eventFrom: eventRange.from,
      eventTo: eventRange.to,
      origin,
      planIds: [...planIds],
      pinned: false,
    };
    this.versions.push(version);
    this.prune();
    return version;
  }

  get(version: number): ProjectVersion | undefined {
    return this.versions.find(v => v.version === version);
  }

  list(): ReadonlyArray<Omit<ProjectVersion, 'project'>> {
    return this.versions.map(({ project, ...rest }) => rest);
  }

  pin(version: number): void {
    const v = this.get(version);
    if (!v) throw new Error(`Version ${version} not found`);
    v.pinned = true;
  }

  unpin(version: number): void {
    const v = this.get(version);
    if (v) v.pinned = false;
  }

  /** Restore is handled by caller: they take .project and dispatch a restore event. */
  restore(version: number): Project {
    const v = this.get(version);
    if (!v) throw new Error(`Version ${version} not found`);
    return structuredClone(v.project);
  }

  private prune(): void {
    while (this.versions.length > this.retention) {
      const idx = this.versions.findIndex(v => !v.pinned);
      if (idx < 0) return; // everything pinned – spec: never prune versions required by active jobs
      // never prune the latest
      if (idx === this.versions.length - 1) return;
      this.versions.splice(idx, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// AI Edit Log (spec §4) – reviewable / acceptable / rejectable AI operations
// ---------------------------------------------------------------------------

export interface AILogEntry {
  id: string;
  planId: string;
  intent: string;
  appliedAt: string;
  version: number;
  status: 'applied' | 'accepted' | 'rejected' | 'undone';
  summary: string;
  affectedClipIds: string[];
}

export class AIEditLog {
  private entries: AILogEntry[] = [];

  record(entry: Omit<AILogEntry, 'id' | 'appliedAt' | 'status'>): AILogEntry {
    const full: AILogEntry = {
      ...entry,
      id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      appliedAt: new Date().toISOString(),
      status: 'applied',
    };
    this.entries.push(full);
    return full;
  }

  setStatus(id: string, status: AILogEntry['status']): void {
    const e = this.entries.find(x => x.id === id);
    if (!e) throw new Error(`AI log entry ${id} not found`);
    e.status = status;
  }

  list(): ReadonlyArray<AILogEntry> {
    return this.entries;
  }
}
