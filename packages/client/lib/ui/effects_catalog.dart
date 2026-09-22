/// Built-in effects / transitions / tools mirrored from the engine capability registry.
/// Used by the Inspector and tool shelves for CapCut-style quick access.

class EffectDef {
  final String id;
  final String name;
  final String category;
  final Map<String, dynamic> defaultParams;
  final bool experimental;

  const EffectDef({
    required this.id,
    required this.name,
    required this.category,
    this.defaultParams = const {},
    this.experimental = false,
  });
}

class TransitionDef {
  final String id;
  final String name;
  final int defaultDurationMs;

  const TransitionDef({
    required this.id,
    required this.name,
    this.defaultDurationMs = 500,
  });
}

class ToolDef {
  final String id;
  final String name;
  final String category;
  final String icon; // Material icon name hint
  final bool available;

  const ToolDef({
    required this.id,
    required this.name,
    required this.category,
    this.icon = 'auto_awesome',
    this.available = true,
  });
}

const kEffects = <EffectDef>[
  // Color
  EffectDef(id: 'color_correct', name: 'Color Correct', category: 'color', defaultParams: {
    'exposure': 0, 'contrast': 0, 'saturation': 0, 'temperature': 0, 'tint': 0,
  }),
  EffectDef(id: 'color_grade', name: 'Color Grade', category: 'color'),
  EffectDef(id: 'lut', name: 'LUT', category: 'color', defaultParams: {'lut_id': 'cinematic_01', 'intensity': 1.0}),
  EffectDef(id: 'brightness', name: 'Brightness', category: 'color', defaultParams: {'amount': 0}),
  EffectDef(id: 'contrast', name: 'Contrast', category: 'color', defaultParams: {'amount': 1}),
  EffectDef(id: 'saturation', name: 'Saturation', category: 'color', defaultParams: {'amount': 1}),
  // Blur / stylize
  EffectDef(id: 'gaussian_blur', name: 'Gaussian Blur', category: 'blur', defaultParams: {'radius': 10}),
  EffectDef(id: 'motion_blur', name: 'Motion Blur', category: 'blur', defaultParams: {'amount': 0.5, 'angle': 0}),
  EffectDef(id: 'sharpen', name: 'Sharpen', category: 'stylize', defaultParams: {'amount': 1}),
  EffectDef(id: 'vignette', name: 'Vignette', category: 'stylize', defaultParams: {'amount': 0.4, 'softness': 0.5}),
  EffectDef(id: 'film_grain', name: 'Film Grain', category: 'stylize', defaultParams: {'amount': 0.3}),
  // Keying
  EffectDef(id: 'chroma_key', name: 'Chroma Key', category: 'keying', defaultParams: {
    'color': '#00FF00', 'similarity': 0.4, 'smoothness': 0.1,
  }),
  EffectDef(id: 'background_remove', name: 'Background Remove', category: 'keying', experimental: true),
  // Masks
  EffectDef(id: 'mask_rectangle', name: 'Rectangle Mask', category: 'mask'),
  EffectDef(id: 'mask_ellipse', name: 'Ellipse Mask', category: 'mask'),
  EffectDef(id: 'mask_path', name: 'Path Mask', category: 'mask'),
  // Audio
  EffectDef(id: 'noise_reduction', name: 'Noise Reduction', category: 'audio', defaultParams: {'amount': 0.6}),
  EffectDef(id: 'eq', name: 'EQ', category: 'audio', defaultParams: {'low': 0, 'mid': 0, 'high': 0}),

  // Expanded color / look (mirrors engine capability registry)
  EffectDef(id: 'hue', name: 'Hue Shift', category: 'color', defaultParams: {'degrees': 0}),
  EffectDef(id: 'curves', name: 'Curves', category: 'color', defaultParams: {'preset': 'increase_contrast'}),
  EffectDef(id: 'colorbalance', name: 'Color Balance', category: 'color', defaultParams: {
    'rs': 0, 'gs': 0, 'bs': 0, 'rm': 0, 'gm': 0, 'bm': 0, 'rh': 0, 'gh': 0, 'bh': 0,
  }),
  EffectDef(id: 'sepia', name: 'Sepia', category: 'look'),
  EffectDef(id: 'mono', name: 'Black & White', category: 'look'),
  EffectDef(id: 'negate', name: 'Negative', category: 'look'),
  EffectDef(id: 'edgedetect', name: 'Edge Detect', category: 'stylize'),
  EffectDef(id: 'pixelate', name: 'Pixelate', category: 'stylize', defaultParams: {'block': 8}),
  EffectDef(id: 'mirror', name: 'Mirror', category: 'transform', defaultParams: {'direction': 'horizontal'}),
  EffectDef(id: 'rotate', name: 'Rotate', category: 'transform', defaultParams: {'degrees': 0}),
  EffectDef(id: 'fade_in', name: 'Fade In', category: 'opacity', defaultParams: {'durationMs': 500}),
  EffectDef(id: 'fade_out', name: 'Fade Out', category: 'opacity', defaultParams: {'durationMs': 500}),
  EffectDef(id: 'boxblur', name: 'Box Blur', category: 'blur', defaultParams: {'radius': 2}),
  EffectDef(id: 'unsharp', name: 'Sharpen+', category: 'detail', defaultParams: {'amount': 1}),

];

const kTransitions = <TransitionDef>[
  TransitionDef(id: 'crossfade', name: 'Crossfade', defaultDurationMs: 500),
  TransitionDef(id: 'dip_to_black', name: 'Dip to Black', defaultDurationMs: 600),
  TransitionDef(id: 'dip_to_white', name: 'Dip to White', defaultDurationMs: 600),
  TransitionDef(id: 'wipe_left', name: 'Wipe Left', defaultDurationMs: 700),
  TransitionDef(id: 'wipe_right', name: 'Wipe Right', defaultDurationMs: 700),
  TransitionDef(id: 'slide_left', name: 'Slide Left', defaultDurationMs: 600),
  TransitionDef(id: 'slide_up', name: 'Slide Up', defaultDurationMs: 600),
  TransitionDef(id: 'zoom_in', name: 'Zoom In', defaultDurationMs: 800),
  TransitionDef(id: 'zoom', name: 'Zoom', defaultDurationMs: 700),
  TransitionDef(id: 'glitch', name: 'Glitch', defaultDurationMs: 400),
];

/// CapCut-style tool shelf – every major capability reachable from the UI.
const kTools = <ToolDef>[
  ToolDef(id: 'import', name: 'Import', category: 'media', icon: 'download'),
  ToolDef(id: 'trim', name: 'Trim / Cut', category: 'edit', icon: 'content_cut'),
  ToolDef(id: 'split', name: 'Split', category: 'edit', icon: 'call_split'),
  ToolDef(id: 'speed', name: 'Speed', category: 'edit', icon: 'speed'),
  ToolDef(id: 'reverse', name: 'Reverse', category: 'edit', icon: 'replay'),
  ToolDef(id: 'keyframe', name: 'Keyframes', category: 'edit', icon: 'timeline'),
  ToolDef(id: 'transform', name: 'Transform', category: 'edit', icon: 'transform'),
  ToolDef(id: 'effects', name: 'Effects', category: 'fx', icon: 'auto_awesome'),
  ToolDef(id: 'transitions', name: 'Transitions', category: 'fx', icon: 'animation'),
  ToolDef(id: 'masks', name: 'Masks', category: 'fx', icon: 'crop'),
  ToolDef(id: 'chroma', name: 'Chroma Key', category: 'fx', icon: 'filter_center_focus'),
  ToolDef(id: 'bg_remove', name: 'BG Remove', category: 'fx', icon: 'person_off', available: true),
  ToolDef(id: 'motion_track', name: 'Motion Track', category: 'fx', icon: 'gps_fixed'),
  ToolDef(id: 'text', name: 'Text', category: 'overlay', icon: 'text_fields'),
  ToolDef(id: 'captions', name: 'Captions', category: 'overlay', icon: 'closed_caption'),
  ToolDef(id: 'overlay', name: 'Overlay / PiP', category: 'overlay', icon: 'picture_in_picture_alt'),
  ToolDef(id: 'music', name: 'Music', category: 'audio', icon: 'library_music'),
  ToolDef(id: 'volume', name: 'Volume', category: 'audio', icon: 'volume_up'),
  ToolDef(id: 'ai_director', name: 'AI Director', category: 'ai', icon: 'smart_toy'),
  ToolDef(id: 'export', name: 'Export', category: 'export', icon: 'ios_share'),

  ToolDef(id: 'audio_eq', name: 'EQ', category: 'audio', icon: 'equalizer'),
  ToolDef(id: 'audio_compress', name: 'Compressor', category: 'audio', icon: 'compress'),
  ToolDef(id: 'audio_denoise', name: 'Denoise', category: 'audio', icon: 'noise_aware'),
  ToolDef(id: 'audio_normalize', name: 'Normalize', category: 'audio', icon: 'volume_up'),
  ToolDef(id: 'audio_fade', name: 'Audio Fade', category: 'audio', icon: 'graphic_eq'),

];

List<EffectDef> effectsByCategory(String category) =>
    kEffects.where((e) => e.category == category).toList();

List<ToolDef> toolsByCategory(String category) =>
    kTools.where((t) => t.category == category).toList();
