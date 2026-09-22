/// Performance helpers for the timeline.
///
/// Strategy:
/// - CustomPainter already only repaints when project/ui change
/// - For very long timelines, clamp visible time window
/// - Proxies keep preview decode cheap
/// - Avoid rebuilding the full track list when only playhead moves
/// - Magnetic snap for fluid CapCut-style editing feel

import '../models/timeline_models.dart';

/// Visible time window for virtualization (ms).
class VisibleWindow {
  final Milliseconds startMs;
  final Milliseconds endMs;

  const VisibleWindow(this.startMs, this.endMs);

  bool containsClip(Clip clip) {
    return clip.timelineEndMs >= startMs && clip.timelineStartMs <= endMs;
  }
}

/// Compute the visible window from scroll offset + viewport width.
VisibleWindow visibleWindow({
  required double scrollOffsetPx,
  required double viewportWidthPx,
  required double pixelsPerMs,
  Milliseconds paddingMs = 2000,
}) {
  final start =
      ((scrollOffsetPx / pixelsPerMs) - paddingMs).round().clamp(0, 1 << 30);
  final end = (((scrollOffsetPx + viewportWidthPx) / pixelsPerMs) + paddingMs)
      .round()
      .clamp(0, 1 << 30);
  return VisibleWindow(start, end);
}

/// Filter clips to those overlapping the visible window.
List<Clip> visibleClips(List<Clip> clips, VisibleWindow window) {
  return clips.where(window.containsClip).toList();
}

/// Magnetic snap targets: playhead, clip edges, zero.
class SnapResult {
  final Milliseconds ms;
  final bool snapped;
  final String? reason;

  const SnapResult(this.ms, {this.snapped = false, this.reason});
}

/// Snap [candidateMs] to nearby edges within [thresholdMs].
SnapResult magneticSnap({
  required Milliseconds candidateMs,
  required Project project,
  required Milliseconds playheadMs,
  Milliseconds thresholdMs = 120,
  UUID? ignoreClipId,
}) {
  final targets = <Milliseconds>{0, playheadMs};
  for (final track in project.tracks) {
    for (final clip in track.clips) {
      if (ignoreClipId != null && clip.id == ignoreClipId) continue;
      targets.add(clip.timelineStartMs);
      targets.add(clip.timelineEndMs);
    }
  }

  Milliseconds best = candidateMs;
  var bestDist = thresholdMs + 1;
  String? reason;
  for (final t in targets) {
    final d = (candidateMs - t).abs();
    if (d < bestDist) {
      bestDist = d;
      best = t;
      reason = t == 0
          ? 'zero'
          : t == playheadMs
              ? 'playhead'
              : 'edge';
    }
  }
  if (bestDist <= thresholdMs) {
    return SnapResult(best, snapped: true, reason: reason);
  }
  return SnapResult(candidateMs);
}

/// Preferred zoom levels for smooth pinch/button zoom (px per ms).
const List<double> kZoomStops = [
  0.01,
  0.02,
  0.05,
  0.08,
  0.12,
  0.2,
  0.35,
  0.5,
  0.8,
  1.2,
];

double nearestZoomStop(double current) {
  var best = kZoomStops.first;
  var bestDist = (current - best).abs();
  for (final z in kZoomStops) {
    final d = (current - z).abs();
    if (d < bestDist) {
      bestDist = d;
      best = z;
    }
  }
  return best;
}
