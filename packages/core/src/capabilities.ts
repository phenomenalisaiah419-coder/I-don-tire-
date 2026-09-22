/**
 * Phenova Capability Registry
 *
 * Master Spec §10/§19: "Maintain a versioned capability registry listing
 * supported operations, constraints, platform support and test coverage.
 * Unsupported effects must not appear as available."
 *
 * The UI, the AI tool surface and the render layer ALL read from this
 * registry. A capability that is not registered as `supported` must never
 * be shown as available anywhere in the product.
 */

export type Platform = 'android' | 'ios' | 'server' | 'web';
export type CapabilityStatus = 'supported' | 'unavailable' | 'experimental' | 'partial';

export interface CapabilityEntry {
  /** Stable id used by clips/effects/transitions, e.g. "gaussian_blur" */
  id: string;
  kind: 'effect' | 'transition' | 'operation' | 'export' | 'audio' | 'generation' | 'acquisition';
  status: CapabilityStatus;
  platforms: Platform[];
  /** Human-readable constraints, e.g. "max 4K source", "audio media only" */
  constraints: string[];
  /** FFmpeg filter / implementation reference – empty when not renderable */
  implementation: string;
  /** Which automated suite covers this capability */
  testCoverage: string[];
  since: string; // registry schema version that introduced it
}

export const CAPABILITY_REGISTRY_VERSION = '1.0.0';

export const CAPABILITIES: CapabilityEntry[] = [
  // ------------------------------------------------------------- effects
  { id: 'gaussian_blur', kind: 'effect', status: 'supported', platforms: ['android', 'server'],
    constraints: ['radius 0-100'], implementation: 'ffmpeg:gblur', testCoverage: ['render'], since: '1.0.0' },
  { id: 'brightness', kind: 'effect', status: 'supported', platforms: ['android', 'server'],
    constraints: ['-1..1'], implementation: 'ffmpeg:eq', testCoverage: ['render'], since: '1.0.0' },
  { id: 'contrast', kind: 'effect', status: 'supported', platforms: ['android', 'server'],
    constraints: ['0..3'], implementation: 'ffmpeg:eq', testCoverage: ['render'], since: '1.0.0' },
  { id: 'saturation', kind: 'effect', status: 'supported', platforms: ['android', 'server'],
    constraints: ['0..3'], implementation: 'ffmpeg:eq', testCoverage: ['render'], since: '1.0.0' },
  { id: 'color_grade', kind: 'effect', status: 'supported', platforms: ['android', 'server'],
    constraints: ['lift/gamma/gain per channel'], implementation: 'ffmpeg:colorbalance+curves', testCoverage: ['render'], since: '1.0.0' },
  { id: 'lut', kind: 'effect', status: 'supported', platforms: ['android', 'server'],
    constraints: ['.cube file'], implementation: 'ffmpeg:lut3d', testCoverage: ['render'], since: '1.0.0' },
  { id: 'chromakey', kind: 'effect', status: 'supported', platforms: ['android', 'server'],
    constraints: ['key color + similarity + blend'], implementation: 'ffmpeg:chromakey', testCoverage: ['render'], since: '1.0.0' },
  { id: 'sharpen', kind: 'effect', status: 'supported', platforms: ['android', 'server'],
    constraints: ['amount 0-3'], implementation: 'ffmpeg:unsharp', testCoverage: ['render'], since: '1.0.0' },
  { id: 'vignette', kind: 'effect', status: 'supported', platforms: ['android', 'server'],
    constraints: ['angle 0..PI/2'], implementation: 'ffmpeg:vignette', testCoverage: ['render'], since: '1.0.0' },
  { id: 'film_grain', kind: 'effect', status: 'supported', platforms: ['android', 'server'],
    constraints: ['amount 0..1'], implementation: 'ffmpeg:noise', testCoverage: ['render'], since: '1.0.0' },
  { id: 'motion_blur', kind: 'effect', status: 'supported', platforms: ['android', 'server'],
    constraints: ['amount 0..1 (boxblur approximation)'], implementation: 'ffmpeg:boxblur', testCoverage: ['render'], since: '1.0.0' },
  { id: 'color_correct', kind: 'effect', status: 'supported', platforms: ['android', 'server'],
    constraints: ['exposure/contrast/sat/temp/tint'], implementation: 'ffmpeg:eq+colorbalance', testCoverage: ['render'], since: '1.0.0' },
  { id: 'chroma_key', kind: 'effect', status: 'supported', platforms: ['android', 'server'],
    constraints: ['alias of chromakey; key color + similarity + blend'], implementation: 'ffmpeg:chromakey', testCoverage: ['render'], since: '1.0.0' },
  { id: 'mask_rectangle', kind: 'effect', status: 'supported', platforms: ['server'],
    constraints: ['rectangle + optional feather via geq+gblur'], implementation: 'ffmpeg:geq+gblur', testCoverage: [], since: '1.0.0' },
  { id: 'mask_ellipse', kind: 'effect', status: 'supported', platforms: ['server'],
    constraints: ['ellipse via geq distance'], implementation: 'ffmpeg:geq', testCoverage: [], since: '1.0.0' },
  { id: 'background_removal', kind: 'effect', status: 'partial', platforms: ['server'],
    constraints: ['chromakey+despill+edge-refine always; external ML via removeBackground(externalMatting)'], implementation: 'ffmpeg:chromakey (fallback)', testCoverage: ['render'], since: '1.0.0' },
  { id: 'background_remove', kind: 'effect', status: 'partial', platforms: ['server'],
    constraints: ['alias; chromakey fallback when color supplied'], implementation: 'ffmpeg:chromakey (fallback)', testCoverage: ['render'], since: '1.0.0' },
  { id: 'motion_track', kind: 'operation', status: 'partial', platforms: ['server'],
    constraints: ['manual + linear interpolation always available; external optical-flow/AI tracker pluggable via MotionTracker'], implementation: 'render:MotionTracker', testCoverage: [], since: '1.0.0' },
  { id: 'path_mask', kind: 'effect', status: 'supported', platforms: ['server'],
    constraints: ['convex path via geq half-planes; feather supported'], implementation: 'ffmpeg:geq', testCoverage: [], since: '1.0.0' },
  { id: 'keyframed_transform', kind: 'operation', status: 'partial', platforms: ['server', 'android'],
    constraints: ['dense sampling + expression helpers; full continuous per-frame scale/opacity limited by FFmpeg scale filter'], implementation: 'render:keyframeExpression+sampleKeyframes', testCoverage: [], since: '1.0.0' },

  // ---------------------------------------------------------- transitions
  { id: 'crossfade', kind: 'transition', status: 'supported', platforms: ['android', 'server'],
    constraints: ['duration <= min(adjacent clip durations)'], implementation: 'ffmpeg:xfade:fade', testCoverage: ['render'], since: '1.0.0' },
  { id: 'dip_to_black', kind: 'transition', status: 'supported', platforms: ['android', 'server'],
    constraints: [], implementation: 'ffmpeg:xfade:fadeblack', testCoverage: ['render'], since: '1.0.0' },
  { id: 'dip_to_white', kind: 'transition', status: 'supported', platforms: ['android', 'server'],
    constraints: [], implementation: 'ffmpeg:xfade:fadewhite', testCoverage: ['render'], since: '1.0.0' },
  { id: 'wipe_left', kind: 'transition', status: 'supported', platforms: ['android', 'server'],
    constraints: [], implementation: 'ffmpeg:xfade:wipeleft', testCoverage: ['render'], since: '1.0.0' },
  { id: 'wipe_right', kind: 'transition', status: 'supported', platforms: ['android', 'server'],
    constraints: [], implementation: 'ffmpeg:xfade:wiperight', testCoverage: ['render'], since: '1.0.0' },
  { id: 'slide_up', kind: 'transition', status: 'supported', platforms: ['android', 'server'],
    constraints: [], implementation: 'ffmpeg:xfade:slideup', testCoverage: ['render'], since: '1.0.0' },
  { id: 'zoom', kind: 'transition', status: 'supported', platforms: ['android', 'server'],
    constraints: [], implementation: 'ffmpeg:xfade:smoothup', testCoverage: ['render'], since: '1.0.0' },

  // ----------------------------------------------------------- operations
  { id: 'trim', kind: 'operation', status: 'supported', platforms: ['android', 'server'], constraints: [], implementation: 'core:event', testCoverage: ['unit'], since: '1.0.0' },
  { id: 'split', kind: 'operation', status: 'supported', platforms: ['android', 'server'], constraints: ['split point inside clip'], implementation: 'core:event', testCoverage: ['unit'], since: '1.0.0' },
  { id: 'merge', kind: 'operation', status: 'supported', platforms: ['android', 'server'], constraints: ['same media, adjacent'], implementation: 'core:event', testCoverage: ['unit'], since: '1.0.0' },
  { id: 'reorder', kind: 'operation', status: 'supported', platforms: ['android', 'server'], constraints: [], implementation: 'core:event', testCoverage: ['unit'], since: '1.0.0' },
  { id: 'speed', kind: 'operation', status: 'supported', platforms: ['android', 'server'], constraints: ['0.1x..10x'], implementation: 'ffmpeg:setpts+atempo-chain', testCoverage: ['unit', 'render'], since: '1.0.0' },
  { id: 'reverse', kind: 'operation', status: 'supported', platforms: ['android', 'server'], constraints: [], implementation: 'ffmpeg:reverse', testCoverage: ['render'], since: '1.0.0' },
  { id: 'freeze', kind: 'operation', status: 'supported', platforms: ['android', 'server'], constraints: [], implementation: 'ffmpeg:tpad+trim', testCoverage: ['render'], since: '1.0.0' },
  { id: 'crop', kind: 'operation', status: 'supported', platforms: ['android', 'server'], constraints: [], implementation: 'ffmpeg:crop', testCoverage: ['render'], since: '1.0.0' },
  { id: 'rotate', kind: 'operation', status: 'supported', platforms: ['android', 'server'], constraints: ['degrees'], implementation: 'ffmpeg:rotate', testCoverage: ['render'], since: '1.0.0' },
  { id: 'keyframe_animation', kind: 'operation', status: 'supported', platforms: ['android', 'server'], constraints: ['sampled at render fps'], implementation: 'render:sampled-transform', testCoverage: ['render'], since: '1.0.0' },
  { id: 'text_overlay', kind: 'operation', status: 'supported', platforms: ['android', 'server'], constraints: ['bundled fonts'], implementation: 'ffmpeg:drawtext', testCoverage: ['render'], since: '1.0.0' },
  { id: 'captions', kind: 'operation', status: 'supported', platforms: ['android', 'server'], constraints: [], implementation: 'ffmpeg:subtitles/drawtext', testCoverage: ['render'], since: '1.0.0' },
  { id: 'picture_in_picture', kind: 'operation', status: 'supported', platforms: ['android', 'server'], constraints: ['overlay track'], implementation: 'ffmpeg:overlay', testCoverage: ['render'], since: '1.0.0' },

  // --------------------------------------------------------------- audio
  { id: 'volume', kind: 'audio', status: 'supported', platforms: ['android', 'server'], constraints: ['0..2'], implementation: 'ffmpeg:volume', testCoverage: ['render'], since: '1.0.0' },
  { id: 'mute', kind: 'audio', status: 'supported', platforms: ['android', 'server'], constraints: [], implementation: 'core+ffmpeg', testCoverage: ['render'], since: '1.0.0' },
  { id: 'audio_mix', kind: 'audio', status: 'supported', platforms: ['android', 'server'], constraints: [], implementation: 'ffmpeg:amix', testCoverage: ['render'], since: '1.0.0' },
  { id: 'fade', kind: 'audio', status: 'supported', platforms: ['android', 'server'], constraints: [], implementation: 'ffmpeg:afade', testCoverage: ['render'], since: '1.0.0' },
  { id: 'denoise', kind: 'audio', status: 'supported', platforms: ['server'], constraints: ['server-side only'], implementation: 'ffmpeg:afftdn', testCoverage: ['render'], since: '1.0.0' },
  { id: 'loudnorm', kind: 'audio', status: 'supported', platforms: ['server'], constraints: [], implementation: 'ffmpeg:loudnorm', testCoverage: ['render'], since: '1.0.0' },
  { id: 'beat_sync', kind: 'audio', status: 'unavailable', platforms: [], constraints: ['requires librosa analysis service'], implementation: '', testCoverage: [], since: '1.0.0' },

  // -------------------------------------------------------------- export
  { id: 'export_720p', kind: 'export', status: 'supported', platforms: ['android', 'server'], constraints: [], implementation: 'render:pipeline', testCoverage: ['render'], since: '1.0.0' },
  { id: 'export_1080p', kind: 'export', status: 'supported', platforms: ['android', 'server'], constraints: ['plan-gated'], implementation: 'render:pipeline', testCoverage: ['render'], since: '1.0.0' },
  { id: 'export_4k', kind: 'export', status: 'supported', platforms: ['server'], constraints: ['source >= 4K, server render; honest failure otherwise'], implementation: 'render:pipeline', testCoverage: ['render'], since: '1.0.0' },

  // ---------- expanded color / look effects (real FFmpeg) ----------
  { id: 'hue', kind: 'effect', status: 'supported', platforms: ['android', 'server'],
    constraints: ['degrees -180..180'], implementation: 'ffmpeg:hue', testCoverage: ['render'], since: '1.1.0' },
  { id: 'curves', kind: 'effect', status: 'supported', platforms: ['android', 'server'],
    constraints: ['preset or master/r/g/b points'], implementation: 'ffmpeg:curves', testCoverage: ['render'], since: '1.1.0' },
  { id: 'colorbalance', kind: 'effect', status: 'supported', platforms: ['android', 'server'],
    constraints: ['rs/gs/bs / rm/gm/bm / rh/gh/bh -1..1'], implementation: 'ffmpeg:colorbalance', testCoverage: ['render'], since: '1.1.0' },
  { id: 'eq', kind: 'effect', status: 'supported', platforms: ['android', 'server'],
    constraints: ['brightness/contrast/saturation/gamma'], implementation: 'ffmpeg:eq', testCoverage: ['render'], since: '1.1.0' },
  { id: 'unsharp', kind: 'effect', status: 'supported', platforms: ['android', 'server'],
    constraints: ['luma/chroma amounts'], implementation: 'ffmpeg:unsharp', testCoverage: ['render'], since: '1.1.0' },
  { id: 'boxblur', kind: 'effect', status: 'supported', platforms: ['android', 'server'],
    constraints: ['luma_radius'], implementation: 'ffmpeg:boxblur', testCoverage: ['render'], since: '1.1.0' },
  { id: 'edgedetect', kind: 'effect', status: 'supported', platforms: ['android', 'server'],
    constraints: ['low/high thresholds'], implementation: 'ffmpeg:edgedetect', testCoverage: [], since: '1.1.0' },
  { id: 'negate', kind: 'effect', status: 'supported', platforms: ['android', 'server'],
    constraints: [], implementation: 'ffmpeg:negate', testCoverage: [], since: '1.1.0' },
  { id: 'sepia', kind: 'effect', status: 'supported', platforms: ['android', 'server'],
    constraints: ['intensity 0..1'], implementation: 'ffmpeg:colorchannelmixer', testCoverage: ['render'], since: '1.1.0' },
  { id: 'mono', kind: 'effect', status: 'supported', platforms: ['android', 'server'],
    constraints: [], implementation: 'ffmpeg:hue=s=0', testCoverage: ['render'], since: '1.1.0' },
  { id: 'fade_in', kind: 'effect', status: 'supported', platforms: ['android', 'server'],
    constraints: ['duration_ms'], implementation: 'ffmpeg:fade', testCoverage: ['render'], since: '1.1.0' },
  { id: 'fade_out', kind: 'effect', status: 'supported', platforms: ['android', 'server'],
    constraints: ['duration_ms'], implementation: 'ffmpeg:fade', testCoverage: ['render'], since: '1.1.0' },
  { id: 'mirror', kind: 'effect', status: 'supported', platforms: ['android', 'server'],
    constraints: ['horizontal|vertical'], implementation: 'ffmpeg:hflip/vflip', testCoverage: [], since: '1.1.0' },
  { id: 'rotate', kind: 'effect', status: 'supported', platforms: ['android', 'server'],
    constraints: ['degrees'], implementation: 'ffmpeg:rotate', testCoverage: [], since: '1.1.0' },
  { id: 'pixelate', kind: 'effect', status: 'supported', platforms: ['android', 'server'],
    constraints: ['block size'], implementation: 'ffmpeg:scale+scale', testCoverage: [], since: '1.1.0' },

  // ---------- audio operations ----------
  { id: 'audio_volume', kind: 'audio', status: 'supported', platforms: ['android', 'server'],
    constraints: ['0..2'], implementation: 'ffmpeg:volume', testCoverage: ['render'], since: '1.1.0' },
  { id: 'audio_fade', kind: 'audio', status: 'supported', platforms: ['android', 'server'],
    constraints: ['in/out duration'], implementation: 'ffmpeg:afade', testCoverage: ['render'], since: '1.1.0' },
  { id: 'audio_eq', kind: 'audio', status: 'supported', platforms: ['android', 'server'],
    constraints: ['bass/mid/treble gain dB'], implementation: 'ffmpeg:equalizer/bass/treble', testCoverage: [], since: '1.1.0' },
  { id: 'audio_compress', kind: 'audio', status: 'supported', platforms: ['android', 'server'],
    constraints: ['threshold/ratio/attack/release'], implementation: 'ffmpeg:acompressor', testCoverage: [], since: '1.1.0' },
  { id: 'audio_limiter', kind: 'audio', status: 'supported', platforms: ['android', 'server'],
    constraints: ['limit dB'], implementation: 'ffmpeg:alimiter', testCoverage: [], since: '1.1.0' },
  { id: 'audio_denoise', kind: 'audio', status: 'supported', platforms: ['android', 'server'],
    constraints: [], implementation: 'ffmpeg:afftdn', testCoverage: [], since: '1.1.0' },
  { id: 'audio_normalize', kind: 'audio', status: 'supported', platforms: ['android', 'server'],
    constraints: ['EBU R128'], implementation: 'ffmpeg:loudnorm', testCoverage: ['render'], since: '1.1.0' },
  { id: 'audio_highpass', kind: 'audio', status: 'supported', platforms: ['android', 'server'],
    constraints: ['frequency Hz'], implementation: 'ffmpeg:highpass', testCoverage: [], since: '1.1.0' },
  { id: 'audio_lowpass', kind: 'audio', status: 'supported', platforms: ['android', 'server'],
    constraints: ['frequency Hz'], implementation: 'ffmpeg:lowpass', testCoverage: [], since: '1.1.0' },
  { id: 'audio_duck', kind: 'audio', status: 'partial', platforms: ['server'],
    constraints: ['sidechainapprox via volume automation; true sidechaincompress needs dual input'], implementation: 'ffmpeg:volume+expression', testCoverage: [], since: '1.1.0' },

  { id: 'export_prores', kind: 'export', status: 'supported', platforms: ['server'], constraints: ['large files'], implementation: 'render:pipeline', testCoverage: ['render'], since: '1.0.0' },

  // -------------------------------------------------------- ai systems
  { id: 'ai_edit', kind: 'generation', status: 'supported', platforms: ['server'], constraints: ['provider key configured'], implementation: 'ai:orchestrator', testCoverage: ['unit', 'integration'], since: '1.0.0' },
  { id: 'ai_generate_video', kind: 'generation', status: 'supported', platforms: ['server'], constraints: ['explicit user authorization only'], implementation: 'ai:generation', testCoverage: ['integration'], since: '1.0.0' },
  { id: 'media_acquisition', kind: 'acquisition', status: 'supported', platforms: ['android', 'server'], constraints: ['licensed providers only (Pexels/Pixabay APIs)'], implementation: 'ai:stock', testCoverage: ['unit'], since: '1.0.0' },
];

// ---------------------------------------------------------------------------
// Query API
// ---------------------------------------------------------------------------

export function getCapability(id: string): CapabilityEntry | undefined {
  return CAPABILITIES.find(c => c.id === id);
}

export function isSupported(id: string, platform: Platform): boolean {
  const c = getCapability(id);
  return !!c && c.status === 'supported' && c.platforms.includes(platform);
}

export function listAvailable(kind: CapabilityEntry['kind'], platform: Platform): CapabilityEntry[] {
  return CAPABILITIES.filter(
    c => c.kind === kind && c.status === 'supported' && c.platforms.includes(platform)
  );
}

/**
 * Guard used by engine + render layers. Throws on unsupported capability so
 * unsupported effects can never silently "succeed".
 */
export function assertSupported(id: string, platform: Platform): CapabilityEntry {
  const c = getCapability(id);
  if (!c) throw new Error(`Unknown capability "${id}" (registry v${CAPABILITY_REGISTRY_VERSION})`);
  if (c.status === 'unavailable') {
    throw new Error(`Capability "${id}" is unavailable and must not be used (spec §19: no fake capability)`);
  }
  if (c.status !== 'supported' && c.status !== 'partial' && c.status !== 'experimental') {
    throw new Error(`Capability "${id}" has unknown status "${c.status}"`);
  }
  if (!c.platforms.includes(platform)) {
    throw new Error(`Capability "${id}" is not supported on platform "${platform}"`);
  }
  return c;
}
