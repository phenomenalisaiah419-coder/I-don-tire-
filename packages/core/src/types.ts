/**
 * Phenova Core Types
 * 
 * Strict, versioned, production-grade type definitions for the entire editor.
 * All timeline state is derived from an immutable event log.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export type UUID = string;
export type Milliseconds = number;
export type Frames = number;

export const UUIDSchema = z.string().uuid();
export const MsSchema = z.number().nonnegative();

// ---------------------------------------------------------------------------
// Media Provenance – critical for generation isolation & rights
// ---------------------------------------------------------------------------

export type MediaSource =
  | { kind: 'user'; localPath?: string; cloudId?: string }
  | { kind: 'licensed'; provider: string; assetId: string; license: string }
  | { kind: 'generated'; model: string; prompt: string; seed?: number; jobId: string };

export const MediaSourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('user'),
    localPath: z.string().optional(),
    cloudId: z.string().optional(),
  }),
  z.object({
    kind: z.literal('licensed'),
    provider: z.string(),
    assetId: z.string(),
    license: z.string(),
  }),
  z.object({
    kind: z.literal('generated'),
    model: z.string(),
    prompt: z.string(),
    seed: z.number().optional(),
    jobId: z.string(),
  }),
]);

// ---------------------------------------------------------------------------
// Media Asset
// ---------------------------------------------------------------------------

export interface MediaAsset {
  id: UUID;
  source: MediaSource;
  type: 'video' | 'audio' | 'image';
  durationMs: Milliseconds;
  width?: number;
  height?: number;
  fps?: number;
  sampleRate?: number;
  channels?: number;
  codec?: string;
  path: string;          // local or cloud path after import
  proxyPath?: string;
  thumbnailPath?: string;
  analysis?: MediaAnalysis;
  createdAt: string;
  updatedAt: string;
}

export interface MediaAnalysis {
  scenes: SceneBoundary[];
  faces?: FaceTrack[];
  objects?: ObjectTrack[];
  audio?: AudioAnalysis;
  qualityScore?: number;
  embedding?: number[];  // semantic embedding for "find best moments"
}

export interface SceneBoundary {
  startMs: Milliseconds;
  endMs: Milliseconds;
  confidence: number;
}

export interface FaceTrack {
  trackId: string;
  frames: Array<{ timeMs: Milliseconds; box: BoundingBox; confidence: number }>;
}

export interface ObjectTrack {
  trackId: string;
  label: string;
  frames: Array<{ timeMs: Milliseconds; box: BoundingBox; confidence: number }>;
}

export interface BoundingBox {
  x: number; // 0-1 normalized
  y: number;
  w: number;
  h: number;
}

export interface AudioAnalysis {
  beats: Milliseconds[];
  energy: Array<{ timeMs: Milliseconds; value: number }>;
  silence: Array<{ startMs: Milliseconds; endMs: Milliseconds }>;
  speakers?: Array<{ id: string; segments: Array<{ startMs: Milliseconds; endMs: Milliseconds }> }>;
}

// ---------------------------------------------------------------------------
// Transform & Keyframes
// ---------------------------------------------------------------------------

export interface Transform2D {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number; // degrees
  opacity: number;  // 0-1
  anchorX: number;
  anchorY: number;
}

export const DEFAULT_TRANSFORM: Transform2D = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  opacity: 1,
  anchorX: 0.5,
  anchorY: 0.5,
};

export type KeyframeProperty =
  | 'x' | 'y' | 'scaleX' | 'scaleY' | 'rotation' | 'opacity'
  | 'volume' | 'speed' | string; // extensible for effect params

export interface Keyframe {
  id: UUID;
  timeMs: Milliseconds; // relative to clip start
  property: KeyframeProperty;
  value: number;
  easing: Easing;
}

export type Easing =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'bezier'
  | { type: 'bezier'; x1: number; y1: number; x2: number; y2: number };

// ---------------------------------------------------------------------------
// Effects & Transitions
// ---------------------------------------------------------------------------

export interface EffectInstance {
  id: UUID;
  effectId: string;          // e.g. "gaussian_blur", "color_grade", "lut"
  enabled: boolean;
  params: Record<string, number | string | boolean>;
  keyframes: Keyframe[];
  mask?: Mask;
}

/** Geometric or tracked mask applied to a clip or effect. */
export interface MaskRect {
  /** Normalized 0–1 relative to frame */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MaskPathPoint {
  x: number; // normalized 0–1
  y: number;
  /** Optional bezier control; if absent treated as linear */
  cp1x?: number;
  cp1y?: number;
  cp2x?: number;
  cp2y?: number;
}

export interface MotionTrackPoint {
  timeMs: Milliseconds;
  x: number; // normalized 0–1 (center of tracked object)
  y: number;
  scale?: number;
  rotation?: number; // degrees
  confidence?: number; // 0–1
}

export interface MotionTrack {
  id: UUID;
  /** Source clip / media this track was derived from */
  mediaId: UUID;
  points: MotionTrackPoint[];
  /** Optional bounding box size at reference frame */
  refWidth?: number;
  refHeight?: number;
  method: 'manual' | 'optical_flow' | 'feature' | 'ai';
}

export interface Mask {
  type: 'rectangle' | 'ellipse' | 'path' | 'track';
  inverted: boolean;
  feather: number; // pixels
  /** For rectangle / ellipse */
  rect?: MaskRect;
  /** For path masks – closed polygon / bezier path in normalized coords */
  path?: MaskPathPoint[];
  /** For track masks – follow a MotionTrack */
  trackId?: string;
  /** Softness / expansion in pixels */
  expand?: number;
}

export interface TransitionInstance {
  id: UUID;
  transitionId: string;      // e.g. "crossfade", "dip_to_black", "wipe"
  durationMs: Milliseconds;
  params: Record<string, number | string | boolean>;
  easing: Easing;
}

// ---------------------------------------------------------------------------
// Clips & Tracks
// ---------------------------------------------------------------------------

export type TrackType = 'video' | 'audio' | 'text' | 'overlay' | 'adjustment';

export interface Clip {
  id: UUID;
  mediaId: UUID;
  trackId: UUID;

  // Source range
  sourceInMs: Milliseconds;
  sourceOutMs: Milliseconds;

  // Timeline placement
  timelineStartMs: Milliseconds;

  // Derived
  // durationMs = sourceOutMs - sourceInMs (before speed)
  speed: number;               // 1.0 = normal, 0.5 = half, 2.0 = double
  reverse: boolean;
  freezeFrameMs?: Milliseconds; // if set, this is a freeze

  transform: Transform2D;
  keyframes: Keyframe[];
  effects: EffectInstance[];

  // Audio specific
  volume: number;              // 0-1
  muted: boolean;

  // Text specific (when media is text or overlay text)
  text?: TextContent;

  transitionIn?: TransitionInstance;
  transitionOut?: TransitionInstance;

  labels?: string[];           // for AI organization
  locked: boolean;
}

export interface TextContent {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  backgroundColor?: string;
  alignment: 'left' | 'center' | 'right';
  animation?: TextAnimation;
}

export interface TextAnimation {
  type: 'none' | 'fade' | 'typewriter' | 'slide' | 'scale' | 'custom';
  durationMs: Milliseconds;
  params?: Record<string, number>;
}

export interface Track {
  id: UUID;
  type: TrackType;
  name: string;
  order: number;               // higher = on top for video
  muted: boolean;
  locked: boolean;
  visible: boolean;
  height: number;              // UI height
  clips: Clip[];
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export interface ProjectSettings {
  width: number;
  height: number;
  fps: number;
  sampleRate: number;
  durationMs: Milliseconds;    // computed or forced
  backgroundColor: string;
}

export interface ProjectMeta {
  id: UUID;
  name: string;
  createdAt: string;
  updatedAt: string;
  version: number;             // schema version
  schemaVersion: string;       // e.g. "1.0.0"
}

export interface Project {
  meta: ProjectMeta;
  settings: ProjectSettings;
  tracks: Track[];
  media: Record<UUID, MediaAsset>;
  markers: Marker[];
  captions: Caption[];
  /**
   * Explicit source/generation policy (spec §5/§7).
   * 'user-only' forbids licensed + generated media; 'user+licensed' allows
   * licensed online media; 'user+licensed+generated' additionally allows AI
   * generation. The execution layer enforces this as a hard constraint.
   */
  policy?: {
    sources: 'user-only' | 'user+licensed' | 'user+licensed+generated';
    allowGeneration: boolean;
  };
  // The event log is stored separately for efficiency
}

export interface Marker {
  id: UUID;
  timeMs: Milliseconds;
  label: string;
  color: string;
}

export interface Caption {
  id: UUID;
  startMs: Milliseconds;
  endMs: Milliseconds;
  text: string;
  style?: Partial<TextContent>;
}

// ---------------------------------------------------------------------------
// Event Sourcing – the source of truth
// ---------------------------------------------------------------------------

export type TimelineEvent =
  | { type: 'PROJECT_CREATED'; project: Project; timestamp: string }
  | { type: 'MEDIA_ADDED'; media: MediaAsset; timestamp: string }
  | { type: 'MEDIA_REMOVED'; mediaId: UUID; timestamp: string }
  | { type: 'TRACK_ADDED'; track: Track; timestamp: string }
  | { type: 'TRACK_REMOVED'; trackId: UUID; timestamp: string }
  | { type: 'TRACK_UPDATED'; trackId: UUID; changes: Partial<Track>; timestamp: string }
  | { type: 'CLIP_ADDED'; clip: Clip; timestamp: string }
  | { type: 'CLIP_REMOVED'; clipId: UUID; timestamp: string }
  | { type: 'CLIP_UPDATED'; clipId: UUID; changes: Partial<Clip>; timestamp: string }
  | { type: 'CLIP_MOVED'; clipId: UUID; newTrackId: UUID; newStartMs: Milliseconds; timestamp: string }
  | { type: 'CLIP_TRIMMED'; clipId: UUID; sourceInMs: Milliseconds; sourceOutMs: Milliseconds; timelineStartMs: Milliseconds; timestamp: string }
  | { type: 'KEYFRAME_ADDED'; clipId: UUID; keyframe: Keyframe; timestamp: string }
  | { type: 'KEYFRAME_REMOVED'; clipId: UUID; keyframeId: UUID; timestamp: string }
  | { type: 'EFFECT_ADDED'; clipId: UUID; effect: EffectInstance; timestamp: string }
  | { type: 'EFFECT_REMOVED'; clipId: UUID; effectId: UUID; timestamp: string }
  | { type: 'EFFECT_UPDATED'; clipId: UUID; effectId: UUID; changes: Partial<EffectInstance>; timestamp: string }
  | { type: 'TRANSITION_SET'; clipId: UUID; side: 'in' | 'out'; transition: TransitionInstance | null; timestamp: string }
  | { type: 'SETTINGS_UPDATED'; settings: Partial<ProjectSettings>; timestamp: string }
  | { type: 'MARKER_ADDED'; marker: Marker; timestamp: string }
  | { type: 'CAPTION_ADDED'; caption: Caption; timestamp: string }
  | { type: 'VERSION_NAMED'; name: string; eventIndex: number; timestamp: string }
  | { type: 'AI_PLAN_APPLIED'; planId: string; events: TimelineEvent[]; timestamp: string }
  | { type: 'PROJECT_RESTORED'; project: Project; fromVersion: number; timestamp: string };

export interface ProjectState {
  project: Project;
  events: TimelineEvent[];
  currentIndex: number;        // for undo/redo
  namedVersions: Array<{ name: string; eventIndex: number }>;
}
