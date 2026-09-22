/**
 * Canonical Project Schema Validation
 *
 * Master Spec §7: one canonical non-destructive project model. Everything
 * that is persisted or crosses a wire boundary is validated against this
 * schema — invalid state is rejected loudly, never silently repaired.
 */

import { z } from 'zod';
import { Project, MediaSourceSchema, UUIDSchema } from './types';

const Ms = z.number().nonnegative();

const TransformSchema = z.object({
  x: z.number(), y: z.number(),
  scaleX: z.number(), scaleY: z.number(),
  rotation: z.number(), opacity: z.number().min(0).max(1),
  anchorX: z.number(), anchorY: z.number(),
});

const KeyframeSchema = z.object({
  id: UUIDSchema,
  timeMs: Ms,
  property: z.string(),
  value: z.number(),
  easing: z.union([z.string(), z.object({
    type: z.literal('bezier'),
    x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number(),
  })]),
});

const EffectSchema = z.object({
  id: UUIDSchema,
  effectId: z.string(),
  enabled: z.boolean(),
  params: z.record(z.union([z.number(), z.string(), z.boolean()])),
  keyframes: z.array(KeyframeSchema),
  mask: z.object({
    type: z.enum(['rectangle', 'ellipse', 'path', 'track']),
    inverted: z.boolean(),
    feather: z.number(),
    rect: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).optional(),
    path: z.array(z.object({
      x: z.number(), y: z.number(),
      cp1x: z.number().optional(), cp1y: z.number().optional(),
      cp2x: z.number().optional(), cp2y: z.number().optional(),
    })).optional(),
    trackId: z.string().optional(),
    expand: z.number().optional(),
  }).optional(),
});

const TransitionSchema = z.object({
  id: UUIDSchema,
  transitionId: z.string(),
  durationMs: Ms,
  params: z.record(z.union([z.number(), z.string(), z.boolean()])),
  easing: z.union([z.string(), z.object({
    type: z.literal('bezier'),
    x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number(),
  })]),
});

const TextContentSchema = z.object({
  text: z.string(),
  fontFamily: z.string(),
  fontSize: z.number().positive(),
  fontWeight: z.number(),
  color: z.string(),
  backgroundColor: z.string().optional(),
  alignment: z.enum(['left', 'center', 'right']),
  animation: z.object({
    type: z.enum(['none', 'fade', 'typewriter', 'slide', 'scale', 'custom']),
    durationMs: Ms,
    params: z.record(z.number()).optional(),
  }).optional(),
});

const ClipSchema = z.object({
  id: UUIDSchema,
  mediaId: UUIDSchema,
  trackId: UUIDSchema,
  sourceInMs: Ms,
  sourceOutMs: Ms,
  timelineStartMs: Ms,
  speed: z.number().positive().max(10),
  reverse: z.boolean(),
  freezeFrameMs: Ms.optional(),
  transform: TransformSchema,
  keyframes: z.array(KeyframeSchema),
  effects: z.array(EffectSchema),
  volume: z.number().min(0).max(2),
  muted: z.boolean(),
  text: TextContentSchema.optional(),
  transitionIn: TransitionSchema.optional(),
  transitionOut: TransitionSchema.optional(),
  labels: z.array(z.string()).optional(),
  locked: z.boolean(),
});

const TrackSchema = z.object({
  id: UUIDSchema,
  type: z.enum(['video', 'audio', 'text', 'overlay', 'adjustment']),
  name: z.string(),
  order: z.number().int(),
  muted: z.boolean(),
  locked: z.boolean(),
  visible: z.boolean(),
  height: z.number().positive(),
  clips: z.array(ClipSchema),
});

const MediaAssetSchema = z.object({
  id: UUIDSchema,
  source: MediaSourceSchema,
  type: z.enum(['video', 'audio', 'image']),
  durationMs: Ms,
  width: z.number().optional(),
  height: z.number().optional(),
  fps: z.number().optional(),
  sampleRate: z.number().optional(),
  channels: z.number().optional(),
  codec: z.string().optional(),
  path: z.string().min(1),
  proxyPath: z.string().optional(),
  thumbnailPath: z.string().optional(),
  analysis: z.unknown().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** Project-level source/generation policy (spec §5/§7). */
export const ProjectPolicySchema = z.object({
  sources: z.enum(['user-only', 'user+licensed', 'user+licensed+generated']).default('user-only'),
  allowGeneration: z.boolean().default(false),
});
export type ProjectPolicy = z.infer<typeof ProjectPolicySchema>;

export const ProjectSchema = z.object({
  meta: z.object({
    id: UUIDSchema,
    name: z.string().min(1).max(200),
    createdAt: z.string(),
    updatedAt: z.string(),
    version: z.number().int().nonnegative(),
    schemaVersion: z.string(),
  }),
  settings: z.object({
    width: z.number().int().positive().max(7680),
    height: z.number().int().positive().max(7680),
    fps: z.number().positive().max(240),
    sampleRate: z.number().int().positive(),
    durationMs: Ms,
    backgroundColor: z.string(),
  }),
  tracks: z.array(TrackSchema),
  media: z.record(MediaAssetSchema),
  markers: z.array(z.object({
    id: UUIDSchema, timeMs: Ms, label: z.string(), color: z.string(),
  })),
  captions: z.array(z.object({
    id: UUIDSchema, startMs: Ms, endMs: Ms, text: z.string(),
    style: TextContentSchema.partial().optional(),
  })),
  policy: ProjectPolicySchema.optional(),
});

export function validateProject(project: unknown): Project {
  const parsed = ProjectSchema.safeParse(project);
  if (!parsed.success) {
    throw new Error(`Invalid project state: ${parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  }

  const p = parsed.data as unknown as Project;

  // Referential integrity: every clip references an existing track + media.
  for (const track of p.tracks) {
    for (const clip of track.clips) {
      if (clip.trackId !== track.id) {
        throw new Error(`Clip ${clip.id} has trackId ${clip.trackId} but lives on track ${track.id}`);
      }
      if (!p.media[clip.mediaId] && !clip.text) {
        throw new Error(`Clip ${clip.id} references missing media ${clip.mediaId}`);
      }
      if (clip.sourceOutMs <= clip.sourceInMs) {
        throw new Error(`Clip ${clip.id} has invalid source range`);
      }
    }
  }
  return p;
}

export function parseProject(json: string): Project {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    throw new Error(`Project JSON is not parseable: ${(e as Error).message}`);
  }
  return validateProject(raw);
}
