/**
 * Timeline Engine – pure functions for applying events and deriving state.
 *
 * This is deliberately pure and side-effect free so it can run on client,
 * server, or in workers with identical results.
 */
import { Project, ProjectState, TimelineEvent, Track, Clip, ProjectSettings, UUID, Milliseconds } from './types';
export declare function createEmptyProject(name: string, settings?: Partial<ProjectSettings>): Project;
export declare function createTrack(type: Track['type'], name: string, order: number): Track;
export declare function createClip(mediaId: UUID, trackId: UUID, timelineStartMs: Milliseconds, sourceInMs: Milliseconds, sourceOutMs: Milliseconds): Clip;
export declare function applyEvent(state: ProjectState, event: TimelineEvent): ProjectState;
export declare function applyEvents(state: ProjectState, events: TimelineEvent[]): ProjectState;
export declare function undo(state: ProjectState): ProjectState;
export declare function redo(state: ProjectState): ProjectState;
export declare function getClipAtTime(project: Project, trackId: UUID, timeMs: Milliseconds): Clip | null;
export declare function getClipsInRange(project: Project, startMs: Milliseconds, endMs: Milliseconds): Clip[];
