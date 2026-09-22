import 'package:flutter_test/flutter_test.dart';
import 'package:phenova/models/timeline_models.dart';
import 'package:phenova/timeline/keyframe_interpolation.dart';

void main() {
  test('interpolates and clamps keyframes', () {
    const frames = [
      Keyframe(id: 'a', timeMs: 0, property: 'opacity', value: 0),
      Keyframe(id: 'b', timeMs: 1000, property: 'opacity', value: 1),
    ];
    expect(evaluateKeyframes(frames, -1), 0);
    expect(evaluateKeyframes(frames, 500), 0.5);
    expect(evaluateKeyframes(frames, 2000), 1);
  });

  test('evaluates animated clip transform while preserving base values', () {
    const clip = Clip(
      id: 'clip',
      mediaId: 'media',
      trackId: 'track',
      sourceInMs: 0,
      sourceOutMs: 2000,
      timelineStartMs: 0,
      transform: Transform2D(x: 10, y: 20, opacity: 0.8),
      keyframes: [
        Keyframe(id: 'x0', timeMs: 0, property: 'x', value: 10),
        Keyframe(id: 'x1', timeMs: 1000, property: 'x', value: 110),
        Keyframe(id: 'o0', timeMs: 0, property: 'opacity', value: 0.8),
        Keyframe(id: 'o1', timeMs: 1000, property: 'opacity', value: 0.4),
      ],
    );
    final transform = evaluateClipTransform(clip, 500);
    expect(transform.x, 60);
    expect(transform.opacity, 0.6);
    expect(transform.y, 20);
    expect(transform.scaleX, 1);
  });

}
