import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'timeline_state.dart';

/// Independent playhead line that only rebuilds when playheadMs changes,
/// not when the full project/tracks change. Overlay on top of the timeline body.
class PlayheadLayer extends ConsumerWidget {
  const PlayheadLayer({
    super.key,
    required this.trackLabelWidth,
    required this.pixelsPerMs,
    required this.height,
    this.scrollOffset = 0,
  });

  final double trackLabelWidth;
  final double pixelsPerMs;
  final double height;
  final double scrollOffset;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Prefer lightweight provider when available; fall back to ui state
    final ms = ref.watch(playheadMsProvider);
    final x = trackLabelWidth + (ms * pixelsPerMs) - scrollOffset;

    return IgnorePointer(
      child: CustomPaint(
        size: Size(double.infinity, height),
        painter: _PlayheadPainter(x: x),
      ),
    );
  }
}

class _PlayheadPainter extends CustomPainter {
  _PlayheadPainter({required this.x});
  final double x;

  @override
  void paint(Canvas canvas, Size size) {
    if (x < 0 || x > size.width) return;
    final paint = Paint()
      ..color = const Color(0xFFFF3B5C)
      ..strokeWidth = 2;
    canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    // head diamond
    final path = Path()
      ..moveTo(x, 0)
      ..lineTo(x - 6, 10)
      ..lineTo(x + 6, 10)
      ..close();
    canvas.drawPath(path, Paint()..color = const Color(0xFFFF3B5C));
  }

  @override
  bool shouldRepaint(covariant _PlayheadPainter old) => old.x != x;
}
