/**
 * High-level timeline operations: split, merge, reorder, ripple delete.
 *
 * Master Spec §3: "Trim, cut, split, merge, reorder and delete."
 * These are pure functions over Project that return the TimelineEvents
 * needed to perform the operation, so they stay non-destructive and
 * undoable through the same event log as everything else.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Project,
  Clip,
  TimelineEvent,
  UUID,
  Milliseconds,
} from './types';

function clipDuration(clip: Clip): Milliseconds {
  return (clip.sourceOutMs - clip.sourceInMs) / (clip.speed || 1);
}

function findClip(project: Project, clipId: UUID): { clip: Clip; trackIndex: number } | null {
  for (let i = 0; i < project.tracks.length; i++) {
    const clip = project.tracks[i].clips.find(c => c.id === clipId);
    if (clip) return { clip, trackIndex: i };
  }
  return null;
}

/**
 * Split a clip at an absolute timeline position. Produces two clips that
 * share the media. The split point must be strictly inside the clip.
 */
export function splitClip(project: Project, clipId: UUID, atTimelineMs: Milliseconds): TimelineEvent[] {
  const found = findClip(project, clipId);
  if (!found) throw new Error(`Clip ${clipId} not found`);
  const { clip } = found;

  const offsetMs = atTimelineMs - clip.timelineStartMs;
  const sourceSplitMs = clip.sourceInMs + offsetMs * (clip.speed || 1);

  if (atTimelineMs <= clip.timelineStartMs || atTimelineMs >= clip.timelineStartMs + clipDuration(clip)) {
    throw new Error('Split point must be strictly inside the clip');
  }
  if (sourceSplitMs <= clip.sourceInMs || sourceSplitMs >= clip.sourceOutMs) {
    throw new Error('Split point maps outside source range');
  }

  const second: Clip = {
    ...structuredClone(clip),
    id: uuidv4(),
    sourceInMs: sourceSplitMs,
    timelineStartMs: atTimelineMs,
    transitionIn: undefined, // transition-in belongs to the new boundary only if set later
  };

  const now = new Date().toISOString();
  return [
    {
      type: 'CLIP_TRIMMED',
      clipId,
      sourceInMs: clip.sourceInMs,
      sourceOutMs: sourceSplitMs,
      timelineStartMs: clip.timelineStartMs,
      timestamp: now,
    },
    { type: 'CLIP_ADDED', clip: second, timestamp: now },
  ];
}

/**
 * Merge two clips. They must reference the same media, sit on the same
 * track, and be adjacent (b starts where a ends) with matching speed.
 */
export function mergeClips(project: Project, clipIdA: UUID, clipIdB: UUID): TimelineEvent[] {
  const a = findClip(project, clipIdA);
  const b = findClip(project, clipIdB);
  if (!a || !b) throw new Error('Both clips must exist');
  if (a.trackIndex !== b.trackIndex) throw new Error('Clips must be on the same track');
  if (a.clip.mediaId !== b.clip.mediaId) throw new Error('Clips must reference the same media');
  if (a.clip.speed !== b.clip.speed || a.clip.reverse !== b.clip.reverse) {
    throw new Error('Clips must have identical speed/reverse to merge');
  }

  const [first, second] =
    a.clip.timelineStartMs <= b.clip.timelineStartMs ? [a.clip, b.clip] : [b.clip, a.clip];

  const firstEnd = first.timelineStartMs + clipDuration(first);
  if (Math.abs(second.timelineStartMs - firstEnd) > 1) {
    throw new Error('Clips must be adjacent on the timeline to merge');
  }
  if (Math.abs(first.sourceOutMs - second.sourceInMs) > 1) {
    throw new Error('Clips are not contiguous in the source media');
  }

  const now = new Date().toISOString();
  return [
    {
      type: 'CLIP_TRIMMED',
      clipId: first.id,
      sourceInMs: first.sourceInMs,
      sourceOutMs: second.sourceOutMs,
      timelineStartMs: first.timelineStartMs,
      timestamp: now,
    },
    { type: 'CLIP_REMOVED', clipId: second.id, timestamp: now },
  ];
}

/**
 * Reorder a clip to a new timeline position on its track (drag to reorder).
 * Collision-free: clips after the insertion point shift right by the moved
 * clip's duration, clips that were after the original position close the gap.
 */
export function reorderClip(project: Project, clipId: UUID, newStartMs: Milliseconds): TimelineEvent[] {
  const found = findClip(project, clipId);
  if (!found) throw new Error(`Clip ${clipId} not found`);
  const { clip, trackIndex } = found;
  const track = project.tracks[trackIndex];

  const now = new Date().toISOString();
  const events: TimelineEvent[] = [];
  const dur = clipDuration(clip);

  // Remove from original position and close the gap.
  const siblings = track.clips
    .filter(c => c.id !== clipId)
    .sort((x, y) => x.timelineStartMs - y.timelineStartMs);

  let cursor = 0;
  const moves: Array<{ id: UUID; start: Milliseconds }> = [];
  for (const s of siblings) {
    if (s.timelineStartMs >= newStartMs) {
      // leave room: these get placed after cursor jumps past the moved clip
      moves.push({ id: s.id, start: cursor + dur });
      cursor = cursor + dur + clipDuration(s);
    } else {
      moves.push({ id: s.id, start: cursor });
      cursor += clipDuration(s);
    }
  }

  for (const m of moves) {
    const orig = track.clips.find(c => c.id === m.id)!;
    if (orig.timelineStartMs !== m.start) {
      events.push({
        type: 'CLIP_MOVED',
        clipId: m.id,
        newTrackId: track.id,
        newStartMs: m.start,
        timestamp: now,
      });
    }
  }
  events.push({
    type: 'CLIP_MOVED',
    clipId,
    newTrackId: track.id,
    newStartMs,
    timestamp: now,
  });
  return events;
}

/**
 * Ripple delete: remove a clip and shift everything after it on the track
 * left by its duration, closing the gap.
 */
export function rippleDeleteClip(project: Project, clipId: UUID): TimelineEvent[] {
  const found = findClip(project, clipId);
  if (!found) throw new Error(`Clip ${clipId} not found`);
  const { clip, trackIndex } = found;
  const track = project.tracks[trackIndex];
  const dur = clipDuration(clip);

  const now = new Date().toISOString();
  const events: TimelineEvent[] = [
    { type: 'CLIP_REMOVED', clipId, timestamp: now },
  ];

  for (const other of track.clips) {
    if (other.id === clipId) continue;
    if (other.timelineStartMs >= clip.timelineStartMs + dur) {
      events.push({
        type: 'CLIP_MOVED',
        clipId: other.id,
        newTrackId: track.id,
        newStartMs: other.timelineStartMs - dur,
        timestamp: now,
      });
    }
  }
  return events;
}

/**
 * Insert a freeze-frame of `durationMs` at an absolute timeline position
 * inside a clip: splits the clip and marks the middle segment as a freeze.
 */
export function insertFreezeFrame(
  project: Project,
  clipId: UUID,
  atTimelineMs: Milliseconds,
  durationMs: Milliseconds
): TimelineEvent[] {
  const found = findClip(project, clipId);
  if (!found) throw new Error(`Clip ${clipId} not found`);
  const { clip } = found;

  const offsetMs = atTimelineMs - clip.timelineStartMs;
  const sourceAtMs = clip.sourceInMs + offsetMs * (clip.speed || 1);

  const events = splitClip(project, clipId, atTimelineMs);
  const addedEvent = events.find(e => e.type === 'CLIP_ADDED');
  if (!addedEvent || addedEvent.type !== 'CLIP_ADDED') throw new Error('split failed');

  const now = new Date().toISOString();
  const freeze: Clip = {
    ...structuredClone(clip),
    id: uuidv4(),
    sourceInMs: sourceAtMs,
    sourceOutMs: sourceAtMs + 1, // single frame of source
    timelineStartMs: atTimelineMs,
    freezeFrameMs: durationMs,
    transitionIn: undefined,
    transitionOut: undefined,
  };

  // shift the second half right by the freeze duration
  const secondId = addedEvent.clip.id;
  const second = { ...addedEvent.clip, timelineStartMs: atTimelineMs + durationMs };

  return [
    events[0], // trim original
    { type: 'CLIP_ADDED', clip: freeze, timestamp: now },
    { type: 'CLIP_REMOVED', clipId: secondId, timestamp: now },
    { type: 'CLIP_ADDED', clip: second, timestamp: now },
  ];
}
