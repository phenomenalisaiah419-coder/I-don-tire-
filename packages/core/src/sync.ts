/**
 * Cloud project sync scaffold.
 *
 * Projects are serialized as JSON (event log + derived state).
 * A remote store implements ProjectStore; local engine pushes/pulls.
 */

import { Project, ProjectState, TimelineEvent } from './types';

export interface ProjectSnapshot {
  version: number;
  schemaVersion: string;
  project: Project;
  events: TimelineEvent[];
  namedVersions: Array<{ name: string; eventIndex: number }>;
  updatedAt: string;
}

export interface ProjectStore {
  save(projectId: string, snapshot: ProjectSnapshot): Promise<void>;
  load(projectId: string): Promise<ProjectSnapshot | null>;
  list(): Promise<Array<{ id: string; name: string; updatedAt: string }>>;
  delete(projectId: string): Promise<void>;
}

/** In-memory store for local/dev. Replace with S3 / Supabase / custom API. */
export class MemoryProjectStore implements ProjectStore {
  private data = new Map<string, ProjectSnapshot>();

  async save(projectId: string, snapshot: ProjectSnapshot): Promise<void> {
    this.data.set(projectId, snapshot);
  }

  async load(projectId: string): Promise<ProjectSnapshot | null> {
    return this.data.get(projectId) ?? null;
  }

  async list() {
    return [...this.data.entries()].map(([id, s]) => ({
      id,
      name: s.project.meta.name,
      updatedAt: s.updatedAt,
    }));
  }

  async delete(projectId: string): Promise<void> {
    this.data.delete(projectId);
  }
}

/** HTTP-backed store pointing at your cloud API */
export class HttpProjectStore implements ProjectStore {
  constructor(
    private baseUrl: string,
    private getToken: () => string | Promise<string>
  ) {}

  private async headers() {
    const token = await this.getToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  async save(projectId: string, snapshot: ProjectSnapshot): Promise<void> {
    const res = await fetch(`${this.baseUrl}/projects/${projectId}`, {
      method: 'PUT',
      headers: await this.headers(),
      body: JSON.stringify(snapshot),
    });
    if (!res.ok) throw new Error(`Sync save failed: ${res.status}`);
  }

  async load(projectId: string): Promise<ProjectSnapshot | null> {
    const res = await fetch(`${this.baseUrl}/projects/${projectId}`, {
      headers: await this.headers(),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Sync load failed: ${res.status}`);
    return (await res.json()) as ProjectSnapshot;
  }

  async list(): Promise<Array<{ id: string; name: string; updatedAt: string }>> {
    const res = await fetch(`${this.baseUrl}/projects`, {
      headers: await this.headers(),
    });
    if (!res.ok) throw new Error(`Sync list failed: ${res.status}`);
    return (await res.json()) as Array<{ id: string; name: string; updatedAt: string }>;
  }

  async delete(projectId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/projects/${projectId}`, {
      method: 'DELETE',
      headers: await this.headers(),
    });
    if (!res.ok) throw new Error(`Sync delete failed: ${res.status}`);
  }
}

export function snapshotFromState(state: ProjectState): ProjectSnapshot {
  return {
    version: state.project.meta.version,
    schemaVersion: state.project.meta.schemaVersion,
    project: state.project,
    events: state.events,
    namedVersions: state.namedVersions,
    updatedAt: new Date().toISOString(),
  };
}
