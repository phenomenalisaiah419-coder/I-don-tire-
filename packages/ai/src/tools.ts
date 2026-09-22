/**
 * Phenova Tool Executor
 *
 * Converts validated AI tool calls into concrete TimelineEvents.
 * This is the bridge between the AI brain and the edit engine.
 *
 * After a direct provider is configured, the ModelRouter produces EditPlans.
 * This module turns those plans into real timeline mutations.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  TimelineEvent,
  Clip,
  EffectInstance,
  TransitionInstance,
  Keyframe,
  TextContent,
  createClip,
  UUID,
  Milliseconds,
  DEFAULT_TRANSFORM,
} from '@phenova/core';
import {
  AIToolName,
  EditPlan,
  isGenerationTool,
} from './protocol';

// ---------------------------------------------------------------------------
// Tool argument types (runtime)
// ---------------------------------------------------------------------------

interface SelectClipsArgs {
  mediaIds: UUID[];
  criteria: string;
  maxCount?: number;
  targetTotalDurationMs?: number;
}

interface PlaceClipArgs {
  mediaId: UUID;
  trackType: 'video' | 'audio' | 'overlay';
  timelineStartMs: Milliseconds;
  sourceInMs?: Milliseconds;
  sourceOutMs?: Milliseconds;
  trackId?: UUID; // optional – will auto-pick if missing
}

interface TrimClipArgs {
  clipId: UUID;
  sourceInMs: Milliseconds;
  sourceOutMs: Milliseconds;
  timelineStartMs?: Milliseconds;
}

interface SetSpeedArgs {
  clipId: UUID;
  speed: number;
  reverse?: boolean;
}

interface AddTransitionArgs {
  clipId: UUID;
  side: 'in' | 'out';
  transitionId: string;
  durationMs: Milliseconds;
  params?: Record<string, number | string | boolean>;
}

interface ApplyEffectArgs {
  clipId: UUID;
  effectId: string;
  params: Record<string, number | string | boolean>;
  enabled?: boolean;
  /** Optional mask attached to this effect instance */
  mask?: {
    type: 'rectangle' | 'ellipse' | 'path' | 'track';
    inverted?: boolean;
    feather?: number;
    rect?: { x: number; y: number; w: number; h: number };
    path?: Array<{ x: number; y: number }>;
    trackId?: string;
  };
}

interface AddKeyframeArgs {
  clipId: UUID;
  property: string;
  timeMs: number;
  value: number;
  easing?: string;
}

interface SetMaskArgs {
  clipId: UUID;
  effectId?: string; // if omitted, attaches to a new generic mask effect
  mask: {
    type: 'rectangle' | 'ellipse' | 'path' | 'track';
    inverted?: boolean;
    feather?: number;
    rect?: { x: number; y: number; w: number; h: number };
    path?: Array<{ x: number; y: number }>;
    trackId?: string;
  };
}

interface TrackMotionArgs {
  clipId: UUID;
  mediaId: UUID;
  seedPoints: Array<{ x: number; y: number }>;
  durationMs: number;
  /** When true, bake track into a path mask on the clip */
  bakeToMask?: boolean;
}

interface AddTextArgs {
  text: string;
  timelineStartMs: Milliseconds;
  durationMs: Milliseconds;
  style?: Partial<TextContent>;
  trackId?: UUID;
}

interface SetVolumeArgs {
  clipId: UUID;
  volume: number;
  muted?: boolean;
}

interface AddMarkerArgs {
  timeMs: Milliseconds;
  label: string;
  color?: string;
}

interface AddCaptionArgs {
  startMs: Milliseconds;
  endMs: Milliseconds;
  text: string;
}

interface GenerateVideoArgs {
  prompt: string;
  durationMs: number;
  aspectRatio?: string;
  style?: string;
}

interface GenerateImageArgs {
  prompt: string;
  aspectRatio?: string;
  style?: string;
}

// ---------------------------------------------------------------------------
// Catalog of built-in transitions & effects (CapCut-class baseline)
// ---------------------------------------------------------------------------

export const BUILTIN_TRANSITIONS: Record<string, { name: string; defaultDurationMs: number }> = {
  crossfade: { name: 'Crossfade', defaultDurationMs: 500 },
  dip_to_black: { name: 'Dip to Black', defaultDurationMs: 600 },
  dip_to_white: { name: 'Dip to White', defaultDurationMs: 600 },
  wipe_left: { name: 'Wipe Left', defaultDurationMs: 700 },
  wipe_right: { name: 'Wipe Right', defaultDurationMs: 700 },
  wipe_up: { name: 'Wipe Up', defaultDurationMs: 700 },
  wipe_down: { name: 'Wipe Down', defaultDurationMs: 700 },
  slide_left: { name: 'Slide Left', defaultDurationMs: 600 },
  slide_right: { name: 'Slide Right', defaultDurationMs: 600 },
  zoom_in: { name: 'Zoom In', defaultDurationMs: 800 },
  zoom_out: { name: 'Zoom Out', defaultDurationMs: 800 },
  glitch: { name: 'Glitch', defaultDurationMs: 400 },
  film_burn: { name: 'Film Burn', defaultDurationMs: 900 },
};

export const BUILTIN_EFFECTS: Record<string, { name: string; category: string; defaultParams: Record<string, number | string | boolean> }> = {
  // Color
  color_correct: {
    name: 'Color Correct',
    category: 'color',
    defaultParams: { exposure: 0, contrast: 0, highlights: 0, shadows: 0, saturation: 0, temperature: 0, tint: 0 },
  },
  color_grade: {
    name: 'Color Grade',
    category: 'color',
    defaultParams: { shadows_r: 0, shadows_g: 0, shadows_b: 0, midtones_r: 0, midtones_g: 0, midtones_b: 0, highlights_r: 0, highlights_g: 0, highlights_b: 0 },
  },
  lut: {
    name: 'LUT',
    category: 'color',
    defaultParams: { lut_id: 'cinematic_01', intensity: 1.0 },
  },
  // Blur & stylize
  gaussian_blur: {
    name: 'Gaussian Blur',
    category: 'blur',
    defaultParams: { radius: 10, quality: 'high' },
  },
  motion_blur: {
    name: 'Motion Blur',
    category: 'blur',
    defaultParams: { amount: 0.5, angle: 0 },
  },
  // Transform helpers
  vignette: {
    name: 'Vignette',
    category: 'stylize',
    defaultParams: { amount: 0.4, softness: 0.5 },
  },
  film_grain: {
    name: 'Film Grain',
    category: 'stylize',
    defaultParams: { amount: 0.3, size: 1.0 },
  },
  // Keying
  chroma_key: {
    name: 'Chroma Key (Green Screen)',
    category: 'keying',
    defaultParams: { color: '#00FF00', similarity: 0.4, smoothness: 0.1, spill: 0.1 },
  },
  background_remove: {
    name: 'Background Removal',
    category: 'keying',
    defaultParams: { model: 'default', edge_feather: 2 },
  },
  mask_rectangle: {
    name: 'Rectangle Mask',
    category: 'mask',
    defaultParams: {},
  },
  mask_ellipse: {
    name: 'Ellipse Mask',
    category: 'mask',
    defaultParams: {},
  },
  mask_path: {
    name: 'Path Mask',
    category: 'mask',
    defaultParams: {},
  },
  // Audio
  noise_reduction: {
    name: 'Noise Reduction',
    category: 'audio',
    defaultParams: { amount: 0.6 },
  },
  eq: {
    name: 'EQ',
    category: 'audio',
    defaultParams: { low: 0, mid: 0, high: 0 },
  },
  // Text / motion
  text_animation: {
    name: 'Text Animation',
    category: 'text',
    defaultParams: { type: 'fade', durationMs: 600 },
  },
};

// ---------------------------------------------------------------------------
// Tool Executor
// ---------------------------------------------------------------------------

export interface ToolContext {
  /** Current project tracks so we can auto-select a track if needed */
  videoTrackIds: UUID[];
  audioTrackIds: UUID[];
  overlayTrackIds: UUID[];
  /** Optional: media durations for smart defaults */
  mediaDurations: Record<UUID, Milliseconds>;
}

export class ToolExecutor {
  constructor(private ctx: ToolContext) {}

  /**
   * Turn an entire EditPlan into a list of TimelineEvents.
   * Generation tools are deliberately left as markers – the real
   * generation happens asynchronously via the direct provider / generation service.
   */
  executePlan(plan: EditPlan): TimelineEvent[] {
    const events: TimelineEvent[] = [];
    const timestamp = new Date().toISOString();

    // HARD CONSTRAINT (spec §5): enforce source/generation policy at the
    // execution layer too – defense in depth on top of plan validation.
    for (const step of plan.steps) {
      for (const call of step.toolCalls) {
        const tool = call.tool as AIToolName;
        if (isGenerationTool(tool) && !plan.constraints.allowGeneration) {
          throw new Error(`Refusing to execute "${tool}": plan constraints forbid generation`);
        }
        if ((isGenerationTool(tool) || tool === 'search_licensed_media') && plan.constraints.useOnlyUserFootage) {
          throw new Error(`Refusing to execute "${tool}": plan constraints restrict to user footage only`);
        }
      }
    }

    // Marker so history knows this was an AI step
    const planMarker: TimelineEvent = {
      type: 'AI_PLAN_APPLIED',
      planId: plan.id,
      events: [],
      timestamp,
    };
    events.push(planMarker);

    for (const step of plan.steps) {
      for (const call of step.toolCalls) {
        const tool = call.tool as AIToolName;
        const args = call.arguments as Record<string, unknown>;

        try {
          const stepEvents = this.executeTool(tool, args, timestamp);
          events.push(...stepEvents);
        } catch (err) {
          // In production we would surface this to the user.
          // For now we keep going so partial plans still apply.
          console.warn(`Tool ${tool} failed:`, err);
        }
      }
    }

    // Update the marker with the real child events (for auditing)
    (planMarker as any).events = events.slice(1);

    return events;
  }

  private executeTool(tool: AIToolName, args: Record<string, unknown>, timestamp: string): TimelineEvent[] {
    switch (tool) {
      case 'place_clip':
        return this.placeClip(args as unknown as PlaceClipArgs, timestamp);
      case 'trim_clip':
        return this.trimClip(args as unknown as TrimClipArgs, timestamp);
      case 'set_speed':
        return this.setSpeed(args as unknown as SetSpeedArgs, timestamp);
      case 'add_transition':
        return this.addTransition(args as unknown as AddTransitionArgs, timestamp);
      case 'apply_effect':
        return this.applyEffect(args as unknown as ApplyEffectArgs, timestamp);
      case 'add_keyframe':
        return this.addKeyframe(args as unknown as AddKeyframeArgs, timestamp);
      case 'set_mask':
        return this.setMask(args as unknown as SetMaskArgs, timestamp);
      case 'track_motion':
        return this.trackMotion(args as unknown as TrackMotionArgs, timestamp);
      case 'add_text':
        return this.addText(args as unknown as AddTextArgs, timestamp);
      case 'set_volume':
        return this.setVolume(args as unknown as SetVolumeArgs, timestamp);
      case 'add_marker':
        return this.addMarker(args as unknown as AddMarkerArgs, timestamp);
      case 'add_caption':
        return this.addCaption(args as unknown as AddCaptionArgs, timestamp);
      case 'select_clips':
        // select_clips is a planning tool – it does not emit timeline events by itself.
        // The model is expected to follow it with place_clip calls.
        return [];
      case 'search_licensed_media':
        // Handled by media acquisition service – returns assets that later become MEDIA_ADDED
        return [];
      case 'generate_video':
      case 'generate_image':
      case 'generate_clip':
        // Generation is async. We emit a marker; the real asset arrives later via MEDIA_ADDED.
        return [{
          type: 'AI_PLAN_APPLIED',
          planId: `gen-${uuidv4()}`,
          events: [],
          timestamp,
        }];
      default:
        console.warn(`Unknown tool: ${tool}`);
        return [];
    }
  }

  // -----------------------------------------------------------------------
  // Individual tool implementations
  // -----------------------------------------------------------------------

  private placeClip(args: PlaceClipArgs, timestamp: string): TimelineEvent[] {
    const trackId =
      args.trackId ||
      (args.trackType === 'video'
        ? this.ctx.videoTrackIds[0]
        : args.trackType === 'audio'
        ? this.ctx.audioTrackIds[0]
        : this.ctx.overlayTrackIds[0]);

    if (!trackId) {
      throw new Error(`No ${args.trackType} track available`);
    }

    const duration = this.ctx.mediaDurations[args.mediaId] ?? 5000;
    const sourceIn = args.sourceInMs ?? 0;
    const sourceOut = args.sourceOutMs ?? duration;

    const clip = createClip(
      args.mediaId,
      trackId,
      args.timelineStartMs,
      sourceIn,
      sourceOut
    );

    return [{
      type: 'CLIP_ADDED',
      clip,
      timestamp,
    }];
  }

  private trimClip(args: TrimClipArgs, timestamp: string): TimelineEvent[] {
    return [{
      type: 'CLIP_TRIMMED',
      clipId: args.clipId,
      sourceInMs: args.sourceInMs,
      sourceOutMs: args.sourceOutMs,
      timelineStartMs: args.timelineStartMs ?? 0,
      timestamp,
    }];
  }

  private setSpeed(args: SetSpeedArgs, timestamp: string): TimelineEvent[] {
    return [{
      type: 'CLIP_UPDATED',
      clipId: args.clipId,
      changes: {
        speed: args.speed,
        reverse: args.reverse ?? false,
      },
      timestamp,
    }];
  }

  private addTransition(args: AddTransitionArgs, timestamp: string): TimelineEvent[] {
    const def = BUILTIN_TRANSITIONS[args.transitionId] ?? {
      name: args.transitionId,
      defaultDurationMs: 500,
    };

    const transition: TransitionInstance = {
      id: uuidv4(),
      transitionId: args.transitionId,
      durationMs: args.durationMs || def.defaultDurationMs,
      params: args.params ?? {},
      easing: 'easeInOut',
    };

    return [{
      type: 'TRANSITION_SET',
      clipId: args.clipId,
      side: args.side,
      transition,
      timestamp,
    }];
  }

  private applyEffect(args: ApplyEffectArgs, timestamp: string): TimelineEvent[] {
    const def = BUILTIN_EFFECTS[args.effectId];
    const params = {
      ...(def?.defaultParams ?? {}),
      ...args.params,
    };

    const effect: EffectInstance = {
      id: uuidv4(),
      effectId: args.effectId,
      enabled: args.enabled ?? true,
      params,
      keyframes: [],
      mask: args.mask
        ? {
            type: args.mask.type,
            inverted: args.mask.inverted ?? false,
            feather: args.mask.feather ?? 0,
            rect: args.mask.rect,
            path: args.mask.path,
            trackId: args.mask.trackId,
          }
        : undefined,
    };

    return [{
      type: 'EFFECT_ADDED',
      clipId: args.clipId,
      effect,
      timestamp,
    }];
  }

  private addKeyframe(args: AddKeyframeArgs, timestamp: string): TimelineEvent[] {
    const keyframe = {
      id: uuidv4(),
      timeMs: args.timeMs,
      property: args.property,
      value: args.value,
      easing: (args.easing as any) || 'easeInOut',
    };
    return [{
      type: 'KEYFRAME_ADDED',
      clipId: args.clipId,
      keyframe,
      timestamp,
    }];
  }

  private setMask(args: SetMaskArgs, timestamp: string): TimelineEvent[] {
    // Attach mask to a dedicated effect so compositor can pick it up
    const effect: EffectInstance = {
      id: uuidv4(),
      effectId: args.effectId || 'mask_rectangle',
      enabled: true,
      params: {},
      keyframes: [],
      mask: {
        type: args.mask.type,
        inverted: args.mask.inverted ?? false,
        feather: args.mask.feather ?? 2,
        rect: args.mask.rect,
        path: args.mask.path,
        trackId: args.mask.trackId,
      },
    };
    return [{
      type: 'EFFECT_ADDED',
      clipId: args.clipId,
      effect,
      timestamp,
    }];
  }

  private trackMotion(args: TrackMotionArgs, timestamp: string): TimelineEvent[] {
    // Emit a marker that the engine/server can use to run MotionTracker.
    // Real tracking is async; we record the request and optionally a baked path later.
    const trackId = uuidv4();
    const events: TimelineEvent[] = [{
      type: 'MARKER_ADDED',
      marker: {
        id: trackId,
        timeMs: 0,
        label: `motion-track:${args.clipId}`,
        color: '#00BFFF',
      },
      timestamp,
    }];

    if (args.bakeToMask && args.seedPoints.length >= 1) {
      // Immediate static path mask from seed (MotionTracker.bake can refine later)
      const seed = args.seedPoints[0];
      const hw = 0.08, hh = 0.08;
      const path = [
        { x: Math.max(0, seed.x - hw), y: Math.max(0, seed.y - hh) },
        { x: Math.min(1, seed.x + hw), y: Math.max(0, seed.y - hh) },
        { x: Math.min(1, seed.x + hw), y: Math.min(1, seed.y + hh) },
        { x: Math.max(0, seed.x - hw), y: Math.min(1, seed.y + hh) },
      ];
      events.push(...this.setMask({
        clipId: args.clipId,
        effectId: 'mask_path',
        mask: { type: 'path', inverted: false, feather: 3, path },
      }, timestamp));
    }
    return events;
  }

  private addText(args: AddTextArgs, timestamp: string): TimelineEvent[] {
    // Text is modelled as a clip on an overlay/text track with TextContent
    const trackId = args.trackId || this.ctx.overlayTrackIds[0] || this.ctx.videoTrackIds[0];
    if (!trackId) throw new Error('No track available for text');

    // We create a synthetic media id for pure text (in a real system text
    // would be a special clip type or have a generated transparent media).
    const textMediaId = `text-${uuidv4()}`;

    const clip = createClip(
      textMediaId,
      trackId,
      args.timelineStartMs,
      0,
      args.durationMs
    );

    clip.text = {
      text: args.text,
      fontFamily: args.style?.fontFamily ?? 'Inter',
      fontSize: args.style?.fontSize ?? 48,
      fontWeight: args.style?.fontWeight ?? 600,
      color: args.style?.color ?? '#FFFFFF',
      backgroundColor: args.style?.backgroundColor,
      alignment: args.style?.alignment ?? 'center',
      animation: args.style?.animation,
    };

    return [{
      type: 'CLIP_ADDED',
      clip,
      timestamp,
    }];
  }

  private setVolume(args: SetVolumeArgs, timestamp: string): TimelineEvent[] {
    return [{
      type: 'CLIP_UPDATED',
      clipId: args.clipId,
      changes: {
        volume: Math.max(0, Math.min(1, args.volume)),
        muted: args.muted ?? false,
      },
      timestamp,
    }];
  }

  private addMarker(args: AddMarkerArgs, timestamp: string): TimelineEvent[] {
    return [{
      type: 'MARKER_ADDED',
      marker: {
        id: uuidv4(),
        timeMs: args.timeMs,
        label: args.label,
        color: args.color ?? '#6C5CE7',
      },
      timestamp,
    }];
  }

  private addCaption(args: AddCaptionArgs, timestamp: string): TimelineEvent[] {
    return [{
      type: 'CAPTION_ADDED',
      caption: {
        id: uuidv4(),
        startMs: args.startMs,
        endMs: args.endMs,
        text: args.text,
      },
      timestamp,
    }];
  }
}
