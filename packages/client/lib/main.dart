import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'screens/home_screen.dart';
import 'screens/editor_screen.dart';
import 'screens/ai_director_screen.dart';
import 'timeline/timeline_state.dart';
import 'models/timeline_models.dart';
import 'package:uuid/uuid.dart';

void main() {
  runApp(const ProviderScope(child: PhenovaApp()));
}

class PhenovaApp extends StatelessWidget {
  const PhenovaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Phenova',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.light,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF6C5CE7),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
        scaffoldBackgroundColor: Colors.white,
        navigationBarTheme: const NavigationBarThemeData(
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.transparent,
        ),
      ),
      darkTheme: ThemeData(
        brightness: Brightness.dark,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF6C5CE7),
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      home: const HomeScreen(),
    );
  }
}

/// Back-compat alias — real editor lives in screens/editor_screen.dart
class EditorShell extends StatelessWidget {
  const EditorShell({super.key});

  @override
  Widget build(BuildContext context) => const EditorScreen();
}

/// Optional demo seeder for tests / dev (paths are synthetic — not production media).
void seedDemoProject(WidgetRef ref) {
  final project = ref.read(projectProvider.notifier);
  const uuid = Uuid();
  final mediaIds = <String>[];
  for (var i = 0; i < 4; i++) {
    final id = uuid.v4();
    mediaIds.add(id);
    project.addMedia(MediaAsset(
      id: id,
      source: MediaSource.user(localPath: '/demo/clip_$i.mp4'),
      type: 'video',
      durationMs: 6000 + i * 500,
      path: '/demo/clip_$i.mp4',
      width: 1080,
      height: 1920,
      fps: 30,
      qualityScore: 0.8,
    ));
  }
  final tracks = ref.read(projectProvider).tracks;
  final videoTrack = tracks.firstWhere((t) => t.type == TrackType.video);
  var t = 0;
  for (final id in mediaIds) {
    project.addClip(
      mediaId: id,
      trackId: videoTrack.id,
      timelineStartMs: t,
      sourceInMs: 0,
      sourceOutMs: 4000,
    );
    t += 3500;
  }
}
