/**
 * Phenova Core Types
 *
 * Strict, versioned, production-grade type definitions for the entire editor.
 * All timeline state is derived from an immutable event log.
 */
import { z } from 'zod';
export type UUID = string;
export type Milliseconds = number;
export type Frames = number;
export declare const UUIDSchema: z.ZodString;
export declare const MsSchema: z.ZodNumber;
export type MediaSource = {
    kind: 'user';
    localPath?: string;
    cloudId?: string;
} | {
    kind: 'licensed';
    provider: string;
    assetId: string;
    license: string;
} | {
    kind: 'generated';
    model: string;
    prompt: string;
    seed?: number;
    jobId: string;
};
export declare const MediaSourceSchema: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
    kind: z.ZodLiteral<"user">;
    localPath: z.ZodOptional<z.ZodString>;
    cloudId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    kind: "user";
    localPath?: string | undefined;
    cloudId?: string | undefined;
}, {
    kind: "user";
    localPath?: string | undefined;
    cloudId?: string | undefined;
}>, z.ZodObject<{
    kind: z.ZodLiteral<"licensed">;
    provider: z.ZodString;
    assetId: z.ZodString;
    license: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kind: "licensed";
    provider: string;
    assetId: string;
    license: string;
}, {
    kind: "licensed";
    provider: string;
    assetId: string;
    license: string;
}>, z.ZodObject<{
    kind: z.ZodLiteral<"generated">;
    model: z.ZodString;
    prompt: z.ZodString;
    seed: z.ZodOptional<z.ZodNumber>;
    jobId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kind: "generated";
    model: string;
    prompt: string;
    jobId: string;
    seed?: number | undefined;
}, {
    kind: "generated";
    model: string;
    prompt: string;
    jobId: string;
    seed?: number | undefined;
}>]>;
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
    path: string;
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
    embedding?: number[];
}
export interface SceneBoundary {
    startMs: Milliseconds;
    endMs: Milliseconds;
    confidence: number;
}
export interface FaceTrack {
    trackId: string;
    frames: Array<{
        timeMs: Milliseconds;
        box: BoundingBox;
        confidence: number;
    }>;
}
export interface ObjectTrack {
    trackId: string;
    label: string;
    frames: Array<{
        timeMs: Milliseconds;
        box: BoundingBox;
        confidence: number;
    }>;
}
export interface BoundingBox {
    x: number;
    y: number;
    w: number;
    h: number;
}
export interface AudioAnalysis {
    beats: Milliseconds[];
    energy: Array<{
        timeMs: Milliseconds;
        value: number;
    }>;
    silence: Array<{
        startMs: Milliseconds;
        endMs: Milliseconds;
    }>;
    speakers?: Array<{
        id: string;
        segments: Array<{
            startMs: Milliseconds;
            endMs: Milliseconds;
        }>;
    }>;
}
export interface Transform2D {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
    opacity: number;
    anchorX: number;
    anchorY: number;
}
export declare const DEFAULT_TRANSFORM: Transform2D;
export type KeyframeProperty = 'x' | 'y' | 'scaleX' | 'scaleY' | 'rotation' | 'opacity' | 'volume' | 'speed' | string;
export interface Keyframe {
    id: UUID;
    timeMs: Milliseconds;
    property: KeyframeProperty;
    value: number;
    easing: Easing;
}
export type Easing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bezier' | {
    type: 'bezier';
    x1: number;
    y1: number;
    x2: number;
    y2: number;
};
export interface EffectInstance {
    id: UUID;
    effectId: string;
    enabled: boolean;
    params: Record<string, number | string | boolean>;
    keyframes: Keyframe[];
    mask?: Mask;
}
export interface MaskRect {
    x: number;
    y: number;
    w: number;
    h: number;
}
export interface MaskPathPoint {
    x: number;
    y: number;
    cp1x?: number;
    cp1y?: number;
    cp2x?: number;
    cp2y?: number;
}
export interface MotionTrackPoint {
    timeMs: number;
    x: number;
    y: number;
    scale?: number;
    rotation?: number;
    confidence?: number;
}
export interface MotionTrack {
    id: string;
    mediaId: string;
    points: MotionTrackPoint[];
    refWidth?: number;
    refHeight?: number;
    method: 'manual' | 'optical_flow' | 'feature' | 'ai';
}
export interface Mask {
    type: 'rectangle' | 'ellipse' | 'path' | 'track';
    inverted: boolean;
    feather: number;
    rect?: MaskRect;
    path?: MaskPathPoint[];
    trackId?: string;
    expand?: number;
}
export interface TransitionInstance {
    id: UUID;
    transitionId: string;
    durationMs: Milliseconds;
    params: Record<string, number | string | boolean>;
    easing: Easing;
}
export type TrackType = 'video' | 'audio' | 'text' | 'overlay' | 'adjustment';
export interface Clip {
    id: UUID;
    mediaId: UUID;
    trackId: UUID;
    sourceInMs: Milliseconds;
    sourceOutMs: Milliseconds;
    timelineStartMs: Milliseconds;
    speed: number;
    reverse: boolean;
    freezeFrameMs?: Milliseconds;
    transform: Transform2D;
    keyframes: Keyframe[];
    effects: EffectInstance[];
    volume: number;
    muted: boolean;
    text?: TextContent;
    transitionIn?: TransitionInstance;
    transitionOut?: TransitionInstance;
    labels?: string[];
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
    order: number;
    muted: boolean;
    locked: boolean;
    visible: boolean;
    height: number;
    clips: Clip[];
}
export interface ProjectSettings {
    width: number;
    height: number;
    fps: number;
    sampleRate: number;
    durationMs: Milliseconds;
    backgroundColor: string;
}
export interface ProjectMeta {
    id: UUID;
    name: string;
    createdAt: string;
    updatedAt: string;
    version: number;
    schemaVersion: string;
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
export type TimelineEvent = {
    type: 'PROJECT_CREATED';
    project: Project;
    timestamp: string;
} | {
    type: 'MEDIA_ADDED';
    media: MediaAsset;
    timestamp: string;
} | {
    type: 'MEDIA_REMOVED';
    mediaId: UUID;
    timestamp: string;
} | {
    type: 'TRACK_ADDED';
    track: Track;
    timestamp: string;
} | {
    type: 'TRACK_REMOVED';
    trackId: UUID;
    timestamp: string;
} | {
    type: 'TRACK_UPDATED';
    trackId: UUID;
    changes: Partial<Track>;
    timestamp: string;
} | {
    type: 'CLIP_ADDED';
    clip: Clip;
    timestamp: string;
} | {
    type: 'CLIP_REMOVED';
    clipId: UUID;
    timestamp: string;
} | {
    type: 'CLIP_UPDATED';
    clipId: UUID;
    changes: Partial<Clip>;
    timestamp: string;
} | {
    type: 'CLIP_MOVED';
    clipId: UUID;
    newTrackId: UUID;
    newStartMs: Milliseconds;
    timestamp: string;
} | {
    type: 'CLIP_TRIMMED';
    clipId: UUID;
    sourceInMs: Milliseconds;
    sourceOutMs: Milliseconds;
    timelineStartMs: Milliseconds;
    timestamp: string;
} | {
    type: 'KEYFRAME_ADDED';
    clipId: UUID;
    keyframe: Keyframe;
    timestamp: string;
} | {
    type: 'KEYFRAME_REMOVED';
    clipId: UUID;
    keyframeId: UUID;
    timestamp: string;
} | {
    type: 'EFFECT_ADDED';
    clipId: UUID;
    effect: EffectInstance;
    timestamp: string;
} | {
    type: 'EFFECT_REMOVED';
    clipId: UUID;
    effectId: UUID;
    timestamp: string;
} | {
    type: 'EFFECT_UPDATED';
    clipId: UUID;
    effectId: UUID;
    changes: Partial<EffectInstance>;
    timestamp: string;
} | {
    type: 'TRANSITION_SET';
    clipId: UUID;
    side: 'in' | 'out';
    transition: TransitionInstance | null;
    timestamp: string;
} | {
    type: 'SETTINGS_UPDATED';
    settings: Partial<ProjectSettings>;
    timestamp: string;
} | {
    type: 'MARKER_ADDED';
    marker: Marker;
    timestamp: string;
} | {
    type: 'CAPTION_ADDED';
    caption: Caption;
    timestamp: string;
} | {
    type: 'VERSION_NAMED';
    name: string;
    eventIndex: number;
    timestamp: string;
} | {
    type: 'AI_PLAN_APPLIED';
    planId: string;
    events: TimelineEvent[];
    timestamp: string;
} | {
    type: 'PROJECT_RESTORED';
    project: Project;
    fromVersion: number;
    timestamp: string;
};
export interface ProjectState {
    project: Project;
    events: TimelineEvent[];
    currentIndex: number;
    namedVersions: Array<{
        name: string;
        eventIndex: number;
    }>;
}
