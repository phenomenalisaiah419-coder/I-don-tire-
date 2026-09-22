/**
 * Timeline Engine – pure functions for applying events and deriving state.
 * 
 * This is deliberately pure and side-effect free so it can run on client,
 * server, or in workers with identical results.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Project,
  ProjectState,
  TimelineEvent,
  Track,
  Clip,
  MediaAsset,
  ProjectSettings,
  DEFAULT_TRANSFORM,
  UUID,
  Milliseconds,
} from './types';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

export function createEmptyProject(name: string, settings?: Partial<ProjectSettings>): Project {
  const now = new Date().toISOString();
  return {
    meta: {
      id: uuidv4(),
      name,
      createdAt: now,
      updatedAt: now,
      version: 1,
      schemaVersion: '1.0.0',
    },
    settings: {
      width: 1080,
      height: 1920,
      fps: 30,
      sampleRate: 48000,
      durationMs: 0,
      backgroundColor: '#000000',
      ...settings,
    },
    tracks: [
      createTrack('video', 'Video 1', 0),
      createTrack('audio', 'Audio 1', 0),
    ],
    media: {},
    markers: [],
    captions: [],
    policy: { sources: 'user-only', allowGeneration: false },
  };
}

export function createTrack(type: Track['type'], name: string, order: number): Track {
  return {
    id: uuidv4(),
    type,
    name,
    order,
    muted: false,
    locked: false,
    visible: true,
    height: type === 'audio' ? 48 : 80,
    clips: [],
  };
}

export function createClip(
  mediaId: UUID,
  trackId: UUID,
  timelineStartMs: Milliseconds,
  sourceInMs: Milliseconds,
  sourceOutMs: Milliseconds
): Clip {
  return {
    id: uuidv4(),
    mediaId,
    trackId,
    sourceInMs,
    sourceOutMs,
    timelineStartMs,
    speed: 1.0,
    reverse: false,
    transform: { ...DEFAULT_TRANSFORM },
    keyframes: [],
    effects: [],
    volume: 1.0,
    muted: false,
    locked: false,
  };
}

// ---------------------------------------------------------------------------
// Event application – the heart of the engine
// ---------------------------------------------------------------------------

export function applyEvent(state: ProjectState, event: TimelineEvent): ProjectState {
  const project = structuredClone(state.project);
  const events = state.events.slice(0, state.currentIndex + 1);
  events.push(event);

  switch (event.type) {
    case 'PROJECT_CREATED':
      // already handled by createEmptyProject
      break;

    case 'MEDIA_ADDED':
      project.media[event.media.id] = event.media;
      break;

    case 'MEDIA_REMOVED':
      delete project.media[event.mediaId];
      // also remove any clips that referenced it
      for (const track of project.tracks) {
        track.clips = track.clips.filter(c => c.mediaId !== event.mediaId);
      }
      break;

    case 'TRACK_ADDED':
      project.tracks.push(event.track);
      project.tracks.sort((a, b) => a.order - b.order);
      break;

    case 'TRACK_REMOVED':
      project.tracks = project.tracks.filter(t => t.id !== event.trackId);
      break;

    case 'TRACK_UPDATED': {
      const track = project.tracks.find(t => t.id === event.trackId);
      if (track) Object.assign(track, event.changes);
      break;
    }

    case 'CLIP_ADDED': {
      const track = project.tracks.find(t => t.id === event.clip.trackId);
      if (track) {
        track.clips.push(event.clip);
        track.clips.sort((a, b) => a.timelineStartMs - b.timelineStartMs);
      }
      break;
    }

    case 'CLIP_REMOVED':
      for (const track of project.tracks) {
        track.clips = track.clips.filter(c => c.id !== event.clipId);
      }
      break;

    case 'CLIP_UPDATED': {
      for (const track of project.tracks) {
        const clip = track.clips.find(c => c.id === event.clipId);
        if (clip) {
          Object.assign(clip, event.changes);
          break;
        }
      }
      break;
    }

    case 'CLIP_MOVED': {
      let clip: Clip | undefined;
      for (const track of project.tracks) {
        const idx = track.clips.findIndex(c => c.id === event.clipId);
        if (idx >= 0) {
          clip = track.clips.splice(idx, 1)[0];
          break;
        }
      }
      if (clip) {
        clip.trackId = event.newTrackId;
        clip.timelineStartMs = event.newStartMs;
        const target = project.tracks.find(t => t.id === event.newTrackId);
        if (target) {
          target.clips.push(clip);
          target.clips.sort((a, b) => a.timelineStartMs - b.timelineStartMs);
        }
      }
      break;
    }

    case 'CLIP_TRIMMED': {
      for (const track of project.tracks) {
        const clip = track.clips.find(c => c.id === event.clipId);
        if (clip) {
          clip.sourceInMs = event.sourceInMs;
          clip.sourceOutMs = event.sourceOutMs;
          clip.timelineStartMs = event.timelineStartMs;
          break;
        }
      }
      break;
    }

    case 'KEYFRAME_ADDED': {
      for (const track of project.tracks) {
        const clip = track.clips.find(c => c.id === event.clipId);
        if (clip) {
          clip.keyframes.push(event.keyframe);
          clip.keyframes.sort((a, b) => a.timeMs - b.timeMs);
          break;
        }
      }
      break;
    }

    case 'KEYFRAME_REMOVED': {
      for (const track of project.tracks) {
        const clip = track.clips.find(c => c.id === event.clipId);
        if (clip) {
          clip.keyframes = clip.keyframes.filter(k => k.id !== event.keyframeId);
          break;
        }
      }
      break;
    }

    case 'EFFECT_ADDED': {
      for (const track of project.tracks) {
        const clip = track.clips.find(c => c.id === event.clipId);
        if (clip) {
          clip.effects.push(event.effect);
          break;
        }
      }
      break;
    }

    case 'EFFECT_REMOVED': {
      for (const track of project.tracks) {
        const clip = track.clips.find(c => c.id === event.clipId);
        if (clip) {
          clip.effects = clip.effects.filter(e => e.id !== event.effectId);
          break;
        }
      }
      break;
    }

    case 'EFFECT_UPDATED': {
      for (const track of project.tracks) {
        const clip = track.clips.find(c => c.id === event.clipId);
        if (clip) {
          const effect = clip.effects.find(e => e.id === event.effectId);
          if (effect) Object.assign(effect, event.changes);
          break;
        }
      }
      break;
    }

    case 'TRANSITION_SET': {
      for (const track of project.tracks) {
        const clip = track.clips.find(c => c.id === event.clipId);
        if (clip) {
          if (event.side === 'in') clip.transitionIn = event.transition ?? undefined;
          else clip.transitionOut = event.transition ?? undefined;
          break;
        }
      }
      break;
    }

    case 'SETTINGS_UPDATED':
      Object.assign(project.settings, event.settings);
      break;

    case 'MARKER_ADDED':
      project.markers.push(event.marker);
      project.markers.sort((a, b) => a.timeMs - b.timeMs);
      break;

    case 'CAPTION_ADDED':
      project.captions.push(event.caption);
      project.captions.sort((a, b) => a.startMs - b.startMs);
      break;

    case 'VERSION_NAMED':
      // handled at state level
      break;

    case 'AI_PLAN_APPLIED':
      // The individual events inside the plan are applied sequentially
      // This event is a marker for history
      break;

    case 'PROJECT_RESTORED':
      // Replace the whole project with the restored snapshot
      project.meta = structuredClone(event.project.meta);
      project.settings = structuredClone(event.project.settings);
      project.tracks = structuredClone(event.project.tracks);
      project.media = structuredClone(event.project.media);
      project.markers = structuredClone(event.project.markers);
      project.captions = structuredClone(event.project.captions);
      project.policy = event.project.policy ? structuredClone(event.project.policy) : project.policy;
      break;
  }

  // Recompute project duration
  let maxEnd = 0;
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      const duration = (clip.sourceOutMs - clip.sourceInMs) / (clip.speed || 1);
      const end = clip.timelineStartMs + duration;
      if (end > maxEnd) maxEnd = end;
    }
  }
  project.settings.durationMs = maxEnd;
  project.meta.updatedAt = event.timestamp;
  project.meta.version += 1;

  const namedVersions = [...state.namedVersions];
  if (event.type === 'VERSION_NAMED') {
    namedVersions.push({ name: event.name, eventIndex: events.length - 1 });
  }

  return {
    project,
    events,
    currentIndex: events.length - 1,
    namedVersions,
  };
}

export function applyEvents(state: ProjectState, events: TimelineEvent[]): ProjectState {
  let current = state;
  for (const event of events) {
    current = applyEvent(current, event);
  }
  return current;
}

// ---------------------------------------------------------------------------
// Undo / Redo
// ---------------------------------------------------------------------------

export function undo(state: ProjectState): ProjectState {
  if (state.currentIndex < 0) return state;
  // Rebuild the project from the event prefix, but RETAIN the full event
  // log so redo remains possible (non-destructive history, spec §3/§7).
  const prefix = state.events.slice(0, state.currentIndex);
  let rebuilt: ProjectState = {
    project: createEmptyProject('temp'),
    events: [],
    currentIndex: -1,
    namedVersions: [],
  };
  const created = state.events.find(e => e.type === 'PROJECT_CREATED');
  if (created && created.type === 'PROJECT_CREATED') {
    rebuilt.project = structuredClone(created.project);
  }
  rebuilt = applyEvents(rebuilt, prefix);
  return {
    ...rebuilt,
    events: state.events, // full log preserved for redo
    currentIndex: state.currentIndex - 1,
    namedVersions: state.namedVersions.filter(v => v.eventIndex <= state.currentIndex - 1),
  };
}

export function redo(state: ProjectState): ProjectState {
  if (state.currentIndex >= state.events.length - 1) return state;
  // Rebuild project from events[0..currentIndex+1] so the re-applied event
  // lands even though the full log is retained (currentIndex guard in
  // applyEvent would otherwise drop it).
  const target = state.currentIndex + 1;
  const prefix = state.events.slice(0, target + 1);
  let rebuilt: ProjectState = {
    project: createEmptyProject('temp'),
    events: [],
    currentIndex: -1,
    namedVersions: [],
  };
  const created = state.events.find(e => e.type === 'PROJECT_CREATED');
  if (created && created.type === 'PROJECT_CREATED') {
    rebuilt.project = structuredClone(created.project);
  }
  rebuilt = applyEvents(rebuilt, prefix);
  return {
    ...rebuilt,
    events: state.events,
    currentIndex: target,
    namedVersions: state.namedVersions.filter(v => v.eventIndex <= target),
  };
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export function getClipAtTime(project: Project, trackId: UUID, timeMs: Milliseconds): Clip | null {
  const track = project.tracks.find(t => t.id === trackId);
  if (!track) return null;
  for (const clip of track.clips) {
    const duration = (clip.sourceOutMs - clip.sourceInMs) / (clip.speed || 1);
    if (timeMs >= clip.timelineStartMs && timeMs < clip.timelineStartMs + duration) {
      return clip;
    }
  }
  return null;
}

export function getClipsInRange(
  project: Project,
  startMs: Milliseconds,
  endMs: Milliseconds
): Clip[] {
  const result: Clip[] = [];
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      const duration = (clip.sourceOutMs - clip.sourceInMs) / (clip.speed || 1);
      const clipEnd = clip.timelineStartMs + duration;
      if (clip.timelineStartMs < endMs && clipEnd > startMs) {
        result.push(clip);
      }
    }
  }
  return result;
}
