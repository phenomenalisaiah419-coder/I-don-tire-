import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/timeline_models.dart';
import 'timeline_state.dart';
import 'performance.dart';

/// Multi-track timeline with selection, drag-to-move, and trim handles.
class TimelineWidget extends ConsumerStatefulWidget {
  const TimelineWidget({super.key});

  @override
  ConsumerState<TimelineWidget> createState() => _TimelineWidgetState();
}

class _TimelineWidgetState extends ConsumerState<TimelineWidget> {
  static const double rulerHeight = 28;
  static const double trackLabelWidth = 100;
  static const double trimHandleWidth = 10;

  // Interaction state
  _DragMode? _dragMode;
  UUID? _activeClipId;
  Milliseconds _dragStartPlayhead = 0;
  double _dragStartX = 0;
  Milliseconds _originalStartMs = 0;
  Milliseconds _originalInMs = 0;
  Milliseconds _originalOutMs = 0;
  final ScrollController _hScroll = ScrollController();
  double _scrollOffset = 0;
  double _viewportWidth = 800;

  double _lastNotifiedScroll = -1;

  @override
  void initState() {
    super.initState();
    // Throttle scroll-driven rebuilds (~16ms) for fluid scrubbing on mid-range phones
    _hScroll.addListener(() {
      final o = _hScroll.offset;
      if ((o - _lastNotifiedScroll).abs() < 1.0) return;
      _lastNotifiedScroll = o;
      setState(() => _scrollOffset = o);
    });
  }

  @override
  void dispose() {
    _hScroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final project = ref.watch(projectProvider);
    final ui = ref.watch(timelineUiProvider);
    final uiNotifier = ref.read(timelineUiProvider.notifier);

    return Column(
      children: [
        _TimelineToolbar(
          ui: ui,
          onZoomIn: uiNotifier.zoomIn,
          onZoomOut: uiNotifier.zoomOut,
          onTogglePlay: uiNotifier.togglePlay,
        ),
        Expanded(
          child: LayoutBuilder(
            builder: (context, constraints) {
              final totalHeight = project.tracks.fold<double>(
                0,
                (sum, t) => sum + t.height + 4,
              );
              final contentWidth = (project.computedDuration * ui.pixelsPerMs)
                  .clamp(constraints.maxWidth, double.infinity)
                  .toDouble();

              return SingleChildScrollView(
                controller: _hScroll,
                scrollDirection: Axis.horizontal,
                child: SizedBox(
                  width: contentWidth + trackLabelWidth,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Track labels
                      SizedBox(
                        width: trackLabelWidth,
                        child: Column(
                          children: [
                            const SizedBox(height: rulerHeight),
                            ...project.tracks.map(
                              (t) => Container(
                                height: t.height + 4,
                                alignment: Alignment.centerLeft,
                                padding: const EdgeInsets.only(left: 8),
                                child: Text(
                                  t.name,
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: t.type == TrackType.audio
                                        ? Colors.greenAccent.withOpacity(0.8)
                                        : Colors.white70,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      // Interactive canvas
                      SizedBox(
                        width: contentWidth,
                        height: totalHeight + rulerHeight,
                        child: GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTapDown: (d) => _onTapDown(d.localPosition, project, ui),
                          onPanStart: (d) => _onPanStart(d.localPosition, project, ui),
                          onPanUpdate: (d) => _onPanUpdate(d.localPosition, project, ui),
                          onPanEnd: (_) => _onPanEnd(),
                          child: CustomPaint(
                            painter: _TimelinePainter(
                              project: project,
                              ui: ui,
                              activeClipId: _activeClipId,
                              dragMode: _dragMode,
                              visibleWindow: visibleWindow(
                                scrollOffsetPx: _scrollOffset,
                                viewportWidthPx: constraints.maxWidth,
                                pixelsPerMs: ui.pixelsPerMs,
                              ),
                            ),
                            size: Size(contentWidth, totalHeight + rulerHeight),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // Hit testing
  // ---------------------------------------------------------------------------

  _HitResult? _hitTest(Offset pos, Project project, TimelineUiState ui) {
    final ppm = ui.pixelsPerMs;
    if (pos.dy < rulerHeight) {
      return _HitResult(kind: _HitKind.ruler, timeMs: (pos.dx / ppm).round());
    }

    var y = rulerHeight;
    for (final track in project.tracks) {
      final trackBottom = y + track.height;
      if (pos.dy >= y && pos.dy < trackBottom + 4) {
        for (final clip in track.clips.reversed) {
          // reversed so top-most (later) wins
          final x = clip.timelineStartMs * ppm;
          final w = (clip.durationMs * ppm).clamp(4.0, double.infinity);
          if (pos.dx >= x && pos.dx <= x + w) {
            // Check trim handles
            if (pos.dx <= x + trimHandleWidth) {
              return _HitResult(
                kind: _HitKind.trimIn,
                clip: clip,
                track: track,
              );
            }
            if (pos.dx >= x + w - trimHandleWidth) {
              return _HitResult(
                kind: _HitKind.trimOut,
                clip: clip,
                track: track,
              );
            }
            return _HitResult(
              kind: _HitKind.clipBody,
              clip: clip,
              track: track,
            );
          }
        }
        return _HitResult(kind: _HitKind.track, track: track);
      }
      y = trackBottom + 4;
    }
    return null;
  }

  void _onTapDown(Offset pos, Project project, TimelineUiState ui) {
    final hit = _hitTest(pos, project, ui);
    final uiNotifier = ref.read(timelineUiProvider.notifier);

    if (hit == null || hit.kind == _HitKind.ruler || hit.kind == _HitKind.track) {
      final ms = (pos.dx / ui.pixelsPerMs).round().clamp(0, 1 << 30);
      uiNotifier.setPlayhead(ms);
      uiNotifier.selectClip(null);
      setState(() {
        _activeClipId = null;
        _dragMode = null;
      });
      return;
    }

    if (hit.clip != null) {
      uiNotifier.selectClip(hit.clip!.id);
      setState(() => _activeClipId = hit.clip!.id);
    }
  }

  void _onPanStart(Offset pos, Project project, TimelineUiState ui) {
    final hit = _hitTest(pos, project, ui);
    if (hit == null || hit.clip == null) {
      // Scrub playhead
      final ms = (pos.dx / ui.pixelsPerMs).round().clamp(0, 1 << 30);
      ref.read(timelineUiProvider.notifier).setPlayhead(ms);
      setState(() {
        _dragMode = _DragMode.scrub;
        _dragStartX = pos.dx;
      });
      return;
    }

    final clip = hit.clip!;
    ref.read(timelineUiProvider.notifier).selectClip(clip.id);

    setState(() {
      _activeClipId = clip.id;
      _dragStartX = pos.dx;
      _originalStartMs = clip.timelineStartMs;
      _originalInMs = clip.sourceInMs;
      _originalOutMs = clip.sourceOutMs;
      _dragStartPlayhead = ui.playheadMs;

      switch (hit.kind) {
        case _HitKind.trimIn:
          _dragMode = _DragMode.trimIn;
          break;
        case _HitKind.trimOut:
          _dragMode = _DragMode.trimOut;
          break;
        case _HitKind.clipBody:
          _dragMode = _DragMode.move;
          break;
        default:
          _dragMode = null;
      }
    });
  }

  void _onPanUpdate(Offset pos, Project project, TimelineUiState ui) {
    if (_dragMode == null) return;
    final ppm = ui.pixelsPerMs;
    final dx = pos.dx - _dragStartX;
    final dMs = (dx / ppm).round();

    if (_dragMode == _DragMode.scrub) {
      final raw = (pos.dx / ppm).round().clamp(0, 1 << 30);
      // Magnetic snap to clip edges while scrubbing for CapCut-like feel
      final snapped = magneticSnap(
        candidateMs: raw,
        project: project,
        playheadMs: ui.playheadMs,
        thresholdMs: 80,
      );
      syncPlayhead(ref, snapped.ms);
      return;
    }

    if (_activeClipId == null) return;
    final projectNotifier = ref.read(projectProvider.notifier);

    switch (_dragMode!) {
      case _DragMode.move:
        final rawStart = (_originalStartMs + dMs).clamp(0, 1 << 30);
        final snapped = magneticSnap(
          candidateMs: rawStart,
          project: project,
          playheadMs: ui.playheadMs,
          thresholdMs: 100,
          ignoreClipId: _activeClipId,
        );
        projectNotifier.updateClip(_activeClipId!, (c) {
          return c.copyWith(timelineStartMs: snapped.ms);
        });
        break;

      case _DragMode.trimIn:
        // Moving left edge: change sourceIn and timelineStart together
        // so the right edge stays fixed in time
        final delta = dMs;
        projectNotifier.updateClip(_activeClipId!, (c) {
          final newIn = (_originalInMs + delta).clamp(0, _originalOutMs - 100);
          final actualDelta = newIn - _originalInMs;
          final newStart = (_originalStartMs + actualDelta).clamp(0, 1 << 30);
          return c.copyWith(
            sourceInMs: newIn,
            timelineStartMs: newStart,
          );
        });
        break;

      case _DragMode.trimOut:
        projectNotifier.updateClip(_activeClipId!, (c) {
          final newOut = (_originalOutMs + dMs).clamp(_originalInMs + 100, 1 << 30);
          return c.copyWith(sourceOutMs: newOut);
        });
        break;

      case _DragMode.scrub:
        break;
    }
  }

  void _onPanEnd() {
    setState(() {
      _dragMode = null;
      // keep selection
    });
  }
}

// ---------------------------------------------------------------------------
// Hit / drag enums
// ---------------------------------------------------------------------------

enum _HitKind { ruler, track, clipBody, trimIn, trimOut }

enum _DragMode { move, trimIn, trimOut, scrub }

class _HitResult {
  final _HitKind kind;
  final Clip? clip;
  final Track? track;
  final Milliseconds? timeMs;

  _HitResult({
    required this.kind,
    this.clip,
    this.track,
    this.timeMs,
  });
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

class _TimelineToolbar extends StatelessWidget {
  final TimelineUiState ui;
  final VoidCallback onZoomIn;
  final VoidCallback onZoomOut;
  final VoidCallback onTogglePlay;

  const _TimelineToolbar({
    required this.ui,
    required this.onZoomIn,
    required this.onZoomOut,
    required this.onTogglePlay,
  });

  @override
  Widget build(BuildContext context) {
    final seconds = ui.playheadMs / 1000;
    final timeStr =
        '${seconds.floor() ~/ 60}:${(seconds % 60).toStringAsFixed(1).padLeft(4, '0')}';

    return Container(
      height: 36,
      color: const Color(0xFF1A1A1F),
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Row(
        children: [
          IconButton(
            icon: Icon(ui.isPlaying ? Icons.pause : Icons.play_arrow, size: 18),
            onPressed: onTogglePlay,
            tooltip: ui.isPlaying ? 'Pause' : 'Play',
          ),
          Text(timeStr, style: const TextStyle(fontSize: 12, fontFamily: 'monospace')),
          const Spacer(),
          IconButton(icon: const Icon(Icons.zoom_out, size: 18), onPressed: onZoomOut),
          Text(
            '${(ui.pixelsPerMs * 1000).toStringAsFixed(0)} px/s',
            style: const TextStyle(fontSize: 11, color: Colors.white54),
          ),
          IconButton(icon: const Icon(Icons.zoom_in, size: 18), onPressed: onZoomIn),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Painter
// ---------------------------------------------------------------------------

class _TimelinePainter extends CustomPainter {
  final Project project;
  final TimelineUiState ui;
  final UUID? activeClipId;
  final _DragMode? dragMode;
  final VisibleWindow? visibleWindow;

  _TimelinePainter({
    required this.project,
    required this.ui,
    this.activeClipId,
    this.dragMode,
    this.visibleWindow,
  });

  @override
  void paint(Canvas canvas, Size size) {
    const rulerHeight = 28.0;
    final ppm = ui.pixelsPerMs;

    // Background
    canvas.drawRect(Offset.zero & size, Paint()..color = const Color(0xFF121216));

    // Ruler
    canvas.drawRect(
      const Rect.fromLTWH(0, 0, double.infinity, rulerHeight).intersect(Offset.zero & size),
      Paint()..color = const Color(0xFF1E1E24),
    );

    final tickPaint = Paint()
      ..color = Colors.white24
      ..strokeWidth = 1;
    final textPainter = TextPainter(textDirection: TextDirection.ltr);

    const majorMs = 1000;
    const minorMs = 250;
    for (var ms = 0; ms * ppm < size.width; ms += minorMs) {
      final x = ms * ppm;
      final isMajor = ms % majorMs == 0;
      canvas.drawLine(
        Offset(x, rulerHeight - (isMajor ? 12 : 6)),
        Offset(x, rulerHeight),
        tickPaint,
      );
      if (isMajor) {
        textPainter.text = TextSpan(
          text: '${ms ~/ 1000}s',
          style: const TextStyle(fontSize: 9, color: Colors.white38),
        );
        textPainter.layout();
        textPainter.paint(canvas, Offset(x + 2, 4));
      }
    }

    // Tracks + clips
    var y = rulerHeight;
    for (final track in project.tracks) {
      final trackBg = Paint()
        ..color = track.type == TrackType.audio
            ? const Color(0xFF0F1A12)
            : const Color(0xFF16161C);
      canvas.drawRect(Rect.fromLTWH(0, y, size.width, track.height), trackBg);

      final clipsToPaint = visibleWindow != null
          ? visibleClips(track.clips, visibleWindow!)
          : track.clips;
      for (final clip in clipsToPaint) {
        final x = clip.timelineStartMs * ppm;
        final w = (clip.durationMs * ppm).clamp(4.0, double.infinity);
        final isSelected = clip.id == ui.selectedClipId || clip.id == activeClipId;

        final rect = RRect.fromRectAndRadius(
          Rect.fromLTWH(x, y + 4, w, track.height - 8),
          const Radius.circular(4),
        );

        final clipPaint = Paint()
          ..color = isSelected
              ? const Color(0xFF6C5CE7)
              : track.type == TrackType.audio
                  ? const Color(0xFF2ECC71).withOpacity(0.7)
                  : const Color(0xFF3498DB).withOpacity(0.75);
        canvas.drawRRect(rect, clipPaint);

        canvas.drawRRect(
          rect,
          Paint()
            ..color = isSelected ? Colors.white : Colors.white12
            ..style = PaintingStyle.stroke
            ..strokeWidth = isSelected ? 1.5 : 0.5,
        );

        // Trim handles when selected
        if (isSelected && w > 24) {
          final handlePaint = Paint()..color = Colors.white;
          canvas.drawRRect(
            RRect.fromRectAndRadius(
              Rect.fromLTWH(x, y + 6, 6, track.height - 12),
              const Radius.circular(2),
            ),
            handlePaint,
          );
          canvas.drawRRect(
            RRect.fromRectAndRadius(
              Rect.fromLTWH(x + w - 6, y + 6, 6, track.height - 12),
              const Radius.circular(2),
            ),
            handlePaint,
          );
        }

        // Label
        if (w > 40) {
          textPainter.text = TextSpan(
            text: clip.mediaId.length > 6
                ? clip.mediaId.substring(0, 6)
                : clip.mediaId,
            style: const TextStyle(fontSize: 10, color: Colors.white),
          );
          textPainter.layout(maxWidth: w - 16);
          textPainter.paint(canvas, Offset(x + 10, y + 12));
        }

        // Transition markers
        if (clip.transitionIn != null) {
          final tw = clip.transitionIn!.durationMs * ppm;
          canvas.drawRect(
            Rect.fromLTWH(x, y + 4, tw.clamp(2, w / 2), 3),
            Paint()..color = Colors.orangeAccent,
          );
        }
      }

      y += track.height + 4;
    }

    // Playhead
    final playX = ui.playheadMs * ppm;
    final playPaint = Paint()
      ..color = const Color(0xFFE74C3C)
      ..strokeWidth = 1.5;
    canvas.drawLine(Offset(playX, 0), Offset(playX, size.height), playPaint);
    final head = Path()
      ..moveTo(playX - 6, 0)
      ..lineTo(playX + 6, 0)
      ..lineTo(playX, 10)
      ..close();
    canvas.drawPath(head, Paint()..color = const Color(0xFFE74C3C));
  }

  @override
  bool shouldRepaint(covariant _TimelinePainter old) {
    return old.project != project ||
        old.ui != ui ||
        old.activeClipId != activeClipId ||
        old.dragMode != dragMode ||
        old.visibleWindow?.startMs != visibleWindow?.startMs ||
        old.visibleWindow?.endMs != visibleWindow?.endMs;
  }
}
