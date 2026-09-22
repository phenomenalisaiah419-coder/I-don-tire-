import '../models/timeline_models.dart';

/// Evaluates a numeric animated property at a timeline position.
///
/// Keyframes are sorted defensively. Values before/after the authored range
/// hold the nearest keyframe value. Linear interpolation is used for now;
/// easing remains available on the model for the renderer to extend.
double evaluateKeyframes(
  List<Keyframe> keyframes,
  Milliseconds timeMs, {
  double fallback = 0,
}) {
  if (keyframes.isEmpty) return fallback;
  final frames = [...keyframes]
    ..sort((a, b) => a.timeMs.compareTo(b.timeMs));
  if (timeMs <= frames.first.timeMs) return frames.first.value;
  if (timeMs >= frames.last.timeMs) return frames.last.value;

  for (var i = 1; i < frames.length; i++) {
    final previous = frames[i - 1];
    final next = frames[i];
    if (timeMs <= next.timeMs) {
      final span = next.timeMs - previous.timeMs;
      if (span <= 0) return next.value;
      final progress = (timeMs - previous.timeMs) / span;
      return previous.value + (next.value - previous.value) * progress;
    }
  }
  return frames.last.value;
}


/// Resolves a clip's animated transform at [timeMs] relative to the clip.
///
/// Only authored transform properties are overridden; all other values retain
/// the clip's base transform. Unknown properties are ignored intentionally.
Transform2D evaluateClipTransform(Clip clip, Milliseconds timeMs) {
  double valueFor(String property, double fallback) {
    final frames = clip.keyframes
        .where((frame) => frame.property == property)
        .toList(growable: false);
    return evaluateKeyframes(frames, timeMs, fallback: fallback);
  }

  final base = clip.transform;
  return Transform2D(
    x: valueFor('x', base.x),
    y: valueFor('y', base.y),
    scaleX: valueFor('scaleX', base.scaleX),
    scaleY: valueFor('scaleY', base.scaleY),
    rotation: valueFor('rotation', base.rotation),
    opacity: valueFor('opacity', base.opacity),
    anchorX: base.anchorX,
    anchorY: base.anchorY,
  );
}
