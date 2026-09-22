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
    namedVersions: Array<{
        name: string;
        eventIndex: number;
    }>;
    updatedAt: string;
}
export interface ProjectStore {
    save(projectId: string, snapshot: ProjectSnapshot): Promise<void>;
    load(projectId: string): Promise<ProjectSnapshot | null>;
    list(): Promise<Array<{
        id: string;
        name: string;
        updatedAt: string;
    }>>;
    delete(projectId: string): Promise<void>;
}
/** In-memory store for local/dev. Replace with S3 / Supabase / custom API. */
export declare class MemoryProjectStore implements ProjectStore {
    private data;
    save(projectId: string, snapshot: ProjectSnapshot): Promise<void>;
    load(projectId: string): Promise<ProjectSnapshot | null>;
    list(): Promise<{
        id: string;
        name: string;
        updatedAt: string;
    }[]>;
    delete(projectId: string): Promise<void>;
}
/** HTTP-backed store pointing at your cloud API */
export declare class HttpProjectStore implements ProjectStore {
    private baseUrl;
    private getToken;
    constructor(baseUrl: string, getToken: () => string | Promise<string>);
    private headers;
    save(projectId: string, snapshot: ProjectSnapshot): Promise<void>;
    load(projectId: string): Promise<ProjectSnapshot | null>;
    list(): Promise<Array<{
        id: string;
        name: string;
        updatedAt: string;
    }>>;
    delete(projectId: string): Promise<void>;
}
export declare function snapshotFromState(state: ProjectState): ProjectSnapshot;
