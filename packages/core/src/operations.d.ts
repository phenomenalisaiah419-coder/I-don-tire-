/**
 * High-level timeline operations: split, merge, reorder, ripple delete.
 *
 * Master Spec §3: "Trim, cut, split, merge, reorder and delete."
 * These are pure functions over Project that return the TimelineEvents
 * needed to perform the operation, so they stay non-destructive and
 * undoable through the same event log as everything else.
 */
import { Project, TimelineEvent, UUID, Milliseconds } from './types';
/**
 * Split a clip at an absolute timeline position. Produces two clips that
 * share the media. The split point must be strictly inside the clip.
 */
export declare function splitClip(project: Project, clipId: UUID, atTimelineMs: Milliseconds): TimelineEvent[];
/**
 * Merge two clips. They must reference the same media, sit on the same
 * track, and be adjacent (b starts where a ends) with matching speed.
 */
export declare function mergeClips(project: Project, clipIdA: UUID, clipIdB: UUID): TimelineEvent[];
/**
 * Reorder a clip to a new timeline position on its track (drag to reorder).
 * Collision-free: clips after the insertion point shift right by the moved
 * clip's duration, clips that were after the original position close the gap.
 */
export declare function reorderClip(project: Project, clipId: UUID, newStartMs: Milliseconds): TimelineEvent[];
/**
 * Ripple delete: remove a clip and shift everything after it on the track
 * left by its duration, closing the gap.
 */
export declare function rippleDeleteClip(project: Project, clipId: UUID): TimelineEvent[];
/**
 * Insert a freeze-frame of `durationMs` at an absolute timeline position
 * inside a clip: splits the clip and marks the middle segment as a freeze.
 */
export declare function insertFreezeFrame(project: Project, clipId: UUID, atTimelineMs: Milliseconds, durationMs: Milliseconds): TimelineEvent[];
