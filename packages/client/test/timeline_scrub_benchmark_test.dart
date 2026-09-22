import 'package:flutter_test/flutter_test.dart';
import 'package:phenova/timeline/performance.dart';
import 'package:phenova/models/timeline_models.dart';

/// Scrub / timeline logic benchmark (runs under `flutter test`).
///
/// Simulates continuous CapCut-style scrub over a dense multi-clip project.
/// Reports microseconds per iteration. Budget: < 200µs on host CI.
///
/// Run:
///   cd packages/client && flutter test test/timeline_scrub_benchmark_test.dart
void main() {
  test('scrub logic sustains high iteration rate', () {
    final project = _denseProject(clipCount: 40, clipDurationMs: 3000);
    const playhead = 15000;
    const iterations = 5000;

    final sw = Stopwatch()..start();
    var snapHits = 0;
    for (var i = 0; i < iterations; i++) {
      final candidate = playhead + (i % 200) - 100;
      final snapped = magneticSnap(
        candidateMs: candidate,
        project: project,
        playheadMs: playhead,
        thresholdMs: 100,
      );
      if (snapped.snapped) snapHits++;

      final window = visibleWindow(
        scrollOffsetPx: (i % 500).toDouble(),
        viewportWidthPx: 400,
        pixelsPerMs: 0.08,
      );
      for (final track in project.tracks) {
        visibleClips(track.clips, window);
      }
    }
    sw.stop();

    final perIterUs = sw.elapsedMicroseconds / iterations;
    expect(perIterUs, lessThan(200),
        reason: 'scrub logic too slow: ${perIterUs.toStringAsFixed(1)}µs/iter');
    expect(snapHits, greaterThan(0));

    // ignore: avoid_print
    print('SCRUB_BENCH iterations=$iterations '
        'elapsed_ms=${sw.elapsedMilliseconds} '
        'us_per_iter=${perIterUs.toStringAsFixed(2)} '
        'snap_hits=$snapHits');
  });

  test('zoom stops are monotonic and cover useful range', () {
    expect(kZoomStops.first, lessThan(kZoomStops.last));
    expect(nearestZoomStop(0.05), equals(0.05));
  });
}

Project _denseProject({required int clipCount, required int clipDurationMs}) {
  final clips = <Clip>[];
  var t = 0;
  for (var i = 0; i < clipCount; i++) {
    clips.add(Clip(
      id: 'c$i',
      mediaId: 'm$i',
      trackId: 'v1',
      timelineStartMs: t,
      sourceInMs: 0,
      sourceOutMs: clipDurationMs,
    ));
    t += clipDurationMs - 200;
  }
  return Project(
    id: 'bench',
    name: 'Bench',
    settings: const ProjectSettings(),
    tracks: [
      Track(
        id: 'v1',
        type: TrackType.video,
        name: 'V1',
        order: 0,
        clips: clips,
      ),
    ],
    media: {
      for (var i = 0; i < clipCount; i++)
        'm$i': MediaAsset(
          id: 'm$i',
          source: MediaSource.user(localPath: '/tmp/x.mp4'),
          path: '/tmp/x.mp4',
          type: 'video',
          durationMs: clipDurationMs,
        ),
    },
    createdAt: DateTime.now(),
    updatedAt: DateTime.now(),
  );
}
