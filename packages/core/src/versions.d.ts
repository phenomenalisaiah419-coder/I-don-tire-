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
import { Project } from './types';
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
    retention?: number;
}
export declare class VersionStore {
    private versions;
    private retention;
    constructor(options?: VersionStoreOptions);
    get size(): number;
    get latest(): ProjectVersion | undefined;
    snapshot(project: Project, eventRange: {
        from: number;
        to: number;
    }, origin: ProjectVersion['origin'], planIds?: string[], name?: string): ProjectVersion;
    get(version: number): ProjectVersion | undefined;
    list(): ReadonlyArray<Omit<ProjectVersion, 'project'>>;
    pin(version: number): void;
    unpin(version: number): void;
    /** Restore is handled by caller: they take .project and dispatch a restore event. */
    restore(version: number): Project;
    private prune;
}
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
export declare class AIEditLog {
    private entries;
    record(entry: Omit<AILogEntry, 'id' | 'appliedAt' | 'status'>): AILogEntry;
    setStatus(id: string, status: AILogEntry['status']): void;
    list(): ReadonlyArray<AILogEntry>;
}
