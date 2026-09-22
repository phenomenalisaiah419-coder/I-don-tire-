import 'package:file_picker/file_picker.dart';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../engine/engine_client.dart';
import '../models/timeline_models.dart';
import '../preview/preview_player.dart';
import '../timeline/timeline_state.dart';
import '../timeline/timeline_widget.dart';
import '../ui/effects_catalog.dart';
import '../services/media_import_service.dart';
import '../preview/preview_quality.dart';
import 'ai_director_screen.dart';
import 'ai_generation_screen.dart';

/// CapCut-like editor shell: preview → timeline → bottom tool dock.
/// Tool order is intentionally different from CapCut. **AI Editor** is the
/// unique “raw manual dope editing” entry (engine plans), separate from AI Gen.
class EditorScreen extends ConsumerStatefulWidget {
  const EditorScreen({super.key});

  @override
  ConsumerState<EditorScreen> createState() => _EditorScreenState();
}

class _EditorScreenState extends ConsumerState<EditorScreen> {
  final _engine = EngineClient();
  bool _working = false;
  String _dock = 'edit'; // which bottom panel is open

  Future<void> _importMedia() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.media,
      allowMultiple: true,
      withData: false,
    );
    if (result == null || result.files.isEmpty) return;
    setState(() => _working = true);
    try {
      final notifier = ref.read(projectProvider.notifier);
      var videoCursor = _trackEnd(TrackType.video);
      var audioCursor = _trackEnd(TrackType.audio);
      for (final f in result.files) {
        if (f.path == null) continue;
        final type = (f.extension == 'mp3' || f.extension == 'wav' || f.extension == 'm4a') ? 'audio' : 'video';
        final id = DateTime.now().microsecondsSinceEpoch.toString() + f.name;
        final durationMs = await _probeDurationMs(f.path!);
        final asset = MediaAsset(
          id: id,
          source: MediaSource.user(localPath: f.path!),
          path: f.path!,
          type: type,
          durationMs: durationMs,
        );
        // On-import auto-proxy (background write-back of proxyPath/thumbnail)
        ref.read(mediaImportServiceProvider).importAndProxyAsync(asset);
        final trackType = type == 'audio' ? TrackType.audio : TrackType.video;
        if (_findTrack(trackType) == null) {
          notifier.addTrack(
            trackType,
            trackType == TrackType.audio ? 'Audio ${_trackCount(trackType) + 1}' : 'Video ${_trackCount(trackType) + 1}',
          );
        }
        final start = trackType == TrackType.audio ? audioCursor : videoCursor;
        final track = _findTrack(trackType)!;
        notifier.addClip(
          mediaId: id,
          trackId: track.id,
          timelineStartMs: start,
          sourceInMs: 0,
          sourceOutMs: durationMs,
        );
        if (trackType == TrackType.audio) {
          audioCursor += durationMs;
        } else {
          videoCursor += durationMs;
        }
      }
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }


  Future<int> _probeDurationMs(String path) async {
    // Probe real media metadata instead of assigning synthetic durations.
    // Some audio codecs/platforms may not be supported by video_player; retain
    // a conservative fallback and surface the limitation in the UI later.
    VideoPlayerController? controller;
    try {
      controller = VideoPlayerController.file(File(path));
      await controller.initialize();
      final duration = controller.value.duration;
      if (duration.inMilliseconds > 0) return duration.inMilliseconds;
    } catch (_) {
      // The import remains usable; unsupported metadata probing is handled by
      // the rendering/ingestion layer in a later pass.
    } finally {
      await controller?.dispose();
    }
    return 1;
  }

  Track? _findTrack(TrackType type) {
    for (final t in ref.read(projectProvider).tracks) {
      if (t.type == type) return t;
    }
    return null;
  }

  int _trackCount(TrackType type) =>
      ref.read(projectProvider).tracks.where((t) => t.type == type).length;

  int _trackEnd(TrackType type) {
    var end = 0;
    for (final t in ref.read(projectProvider).tracks) {
      if (t.type != type) continue;
      for (final c in t.clips) {
        if (c.timelineEndMs > end) end = c.timelineEndMs;
      }
    }
    return end;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B0B10),
      body: SafeArea(
        child: Column(
          children: [
            // Top bar – CapCut-like minimal
            SizedBox(
              height: 48,
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
                    onPressed: () => Navigator.maybePop(context),
                  ),
                  const Text('Edit', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  const Spacer(),
                  // Unique: AI Editor in top-right (CapCut usually puts export here alone)
                  IconButton(
                    tooltip: 'Undo',
                    icon: const Icon(Icons.undo, size: 20),
                    onPressed: () {
                      ref.read(projectProvider.notifier).undo();
                      setState(() {});
                    },
                  ),
                  IconButton(
                    tooltip: 'Redo',
                    icon: const Icon(Icons.redo, size: 20),
                    onPressed: () {
                      ref.read(projectProvider.notifier).redo();
                      setState(() {});
                    },
                  ),
                  TextButton.icon(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const AiDirectorScreen()),
                      );
                    },
                    icon: const Icon(Icons.auto_fix_rounded, size: 18, color: Color(0xFFA29BFE)),
                    label: const Text('AI Editor', style: TextStyle(color: Color(0xFFA29BFE), fontWeight: FontWeight.w700)),
                  ),
                  const _PreviewQualityToggle(),
                  FilledButton(
                    onPressed: () async {
                      try {
                        final res = await _engine.exportVideo(quality: 'high');
                        if (!mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Export: ${res['path'] ?? res}')),
                        );
                      } catch (e) {
                        if (!mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                      }
                    },
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF6C5CE7),
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      visualDensity: VisualDensity.compact,
                    ),
                    child: const Text('Export'),
                  ),
                  const SizedBox(width: 8),
                ],
              ),
            ),

            // Preview
            const Expanded(
              flex: 5,
              child: ColoredBox(
                color: Colors.black,
                child: PreviewPlayer(),
              ),
            ),

            // Timeline
            const Expanded(
              flex: 3,
              child: TimelineWidget(),
            ),

            // Secondary panel (effects / etc when dock selected)
            if (_dock != 'edit')
              SizedBox(
                height: 120,
                child: _DockPanel(dock: _dock),
              ),

            // Bottom tool dock – ORDER deliberately not CapCut’s
            // CapCut-like often: Edit | Audio | Text | Overlay | Effects | Filters | Stickers | Captions
            // Ours: Media | Cut | Speed | Effects | Text | Audio | Overlay | AI Gen | (AI Editor is top bar)
            Container(
              height: 72,
              color: const Color(0xFF121218),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _DockBtn(Icons.add_box_outlined, 'Media', _dock == 'media', () {
                    setState(() => _dock = 'media');
                    _importMedia();
                  }),
                  _DockBtn(Icons.content_cut, 'Cut', _dock == 'cut', () => setState(() => _dock = 'cut')),
                  _DockBtn(Icons.speed, 'Speed', _dock == 'speed', () => setState(() => _dock = 'speed')),
                  _DockBtn(Icons.auto_awesome, 'Effects', _dock == 'effects', () => setState(() => _dock = 'effects')),
                  _DockBtn(Icons.text_fields, 'Text', _dock == 'text', () => setState(() => _dock = 'text')),
                  _DockBtn(Icons.library_music, 'Audio', _dock == 'audio', () => setState(() => _dock = 'audio')),
                  _DockBtn(Icons.layers_outlined, 'Overlay', _dock == 'overlay', () => setState(() => _dock = 'overlay')),
                  _DockBtn(Icons.movie_filter_outlined, 'AI Gen', _dock == 'aigen', () {
                    Navigator.push(context, MaterialPageRoute(builder: (_) => const AiGenerationScreen()));
                  }),
                ],
              ),
            ),
            if (_working) const LinearProgressIndicator(minHeight: 2, color: Color(0xFF6C5CE7)),
          ],
        ),
      ),
    );
  }
}

class _DockBtn extends StatelessWidget {
  const _DockBtn(this.icon, this.label, this.active, this.onTap);
  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = active ? const Color(0xFFA29BFE) : Colors.white70;
    return InkWell(
      onTap: onTap,
      child: SizedBox(
        width: 52,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 22, color: color),
            const SizedBox(height: 4),
            Text(label, style: TextStyle(fontSize: 10, color: color)),
          ],
        ),
      ),
    );
  }
}

class _DockPanel extends ConsumerWidget {
  const _DockPanel({required this.dock});
  final String dock;

  Future<void> _withSelectedClip(
    BuildContext context,
    WidgetRef ref,
    Future<void> Function(String clipId) action,
  ) async {
    final id = ref.read(timelineUiProvider).selectedClipId;
    if (id == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select a clip on the timeline first')),
      );
      return;
    }
    try {
      await action(id);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Applied'), duration: Duration(seconds: 1)),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final engine = EngineClient();
    return Container(
      color: const Color(0xFF15151D),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: switch (dock) {
        'effects' => ListView(
            scrollDirection: Axis.horizontal,
            children: [
              for (final e in kEffects)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ActionChip(
                    label: Text(e.name, style: const TextStyle(fontSize: 12)),
                    onPressed: () => _withSelectedClip(context, ref, (id) async {
                      // Local state + engine
                      ref.read(projectProvider.notifier).updateClip(id, (c) {
                        return c.copyWith(
                          effects: [
                            ...c.effects,
                            EffectInstance(
                              id: e.id + '_' + DateTime.now().microsecondsSinceEpoch.toString(),
                              effectId: e.id,
                              params: Map<String, dynamic>.from(e.defaultParams),
                            ),
                          ],
                        );
                      });
                      try {
                        await engine.applyEffect(clipId: id, effectId: e.id, params: e.defaultParams);
                      } catch (_) {
                        // engine offline: local state still updated
                      }
                    }),
                  ),
                ),
            ],
          ),
        'speed' => Row(
            children: [
              for (final s in [0.5, 1.0, 1.5, 2.0])
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ActionChip(
                    label: Text('${s}x'),
                    onPressed: () => _withSelectedClip(context, ref, (id) async {
                      ref.read(projectProvider.notifier).setClipSpeed(id, s);
                      try {
                        await engine.setClipSpeed(clipId: id, speed: s);
                      } catch (_) {}
                    }),
                  ),
                ),
              ActionChip(
                label: const Text('Reverse'),
                onPressed: () => _withSelectedClip(context, ref, (id) async {
                  ref.read(projectProvider.notifier).updateClip(id, (c) => c.copyWith(reverse: !c.reverse));
                  try {
                    await engine.reverseClip(clipId: id);
                  } catch (_) {}
                }),
              ),
              const SizedBox(width: 8),
              ActionChip(
                label: const Text('Mute / Unmute'),
                onPressed: () => _withSelectedClip(context, ref, (id) async {
                  ref.read(projectProvider.notifier).toggleClipMute(id);
                  // Mute is persisted locally; engine sync is deferred to export.
                }),
              ),
            ],
          ),
        'text' => Center(
            child: FilledButton.tonal(
              onPressed: () async {
                try {
                  await engine.addTextOverlay(text: 'PHENOVA', timelineStartMs: 0, durationMs: 3000);
                } catch (_) {}
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Text overlay requested (engine or local)')),
                  );
                }
              },
              child: const Text('Add text'),
            ),
          ),
        'cut' => Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              FilledButton.tonal(
                onPressed: () => _withSelectedClip(context, ref, (id) async {
                  final ms = ref.read(timelineUiProvider).playheadMs;
                  final changed = ref.read(projectProvider.notifier).splitClipAt(id, ms);
                  if (!changed) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Move the playhead inside the selected clip')),
                      );
                    }
                    return;
                  }
                  // The original clip ID is replaced by two new clip IDs.
                  // Clear stale selection so subsequent tools cannot target a
                  // clip that no longer exists in the local timeline.
                  ref.read(timelineUiProvider.notifier).selectClip(null);
                  try {
                    await engine.splitClip(clipId: id, atTimelineMs: ms);
                  } catch (_) {
                    // The local timeline remains authoritative while the engine
                    // is unavailable; queued synchronization can be added later.
                  }
                }),
                child: const Text('Split at playhead'),
              ),
            ],
          ),
        'overlay' => Row(
            children: [
              ActionChip(
                label: const Text('Chroma key'),
                onPressed: () => _withSelectedClip(context, ref, (id) async {
                  try {
                    await engine.applyEffect(clipId: id, effectId: 'chroma_key');
                  } catch (_) {}
                }),
              ),
              const SizedBox(width: 8),
              ActionChip(
                label: const Text('BG remove'),
                onPressed: () => _withSelectedClip(context, ref, (id) async {
                  try {
                    await engine.removeBackground(clipId: id);
                  } catch (_) {}
                }),
              ),
              const SizedBox(width: 8),
              ActionChip(
                label: const Text('Track motion'),
                onPressed: () => _withSelectedClip(context, ref, (id) async {
                  try {
                    await engine.trackMotion(clipId: id);
                  } catch (_) {}
                }),
              ),
            ],
          ),
        _ => Center(
            child: Text('$dock tools', style: const TextStyle(color: Colors.white54)),
          ),
      },
    );
  }
}

class _PreviewQualityToggle extends ConsumerWidget {
  const _PreviewQualityToggle();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final q = ref.watch(previewQualityProvider);
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(q.label, style: const TextStyle(fontSize: 11)),
        selected: q == PreviewQuality.proxy,
        onSelected: (_) {
          final next = q == PreviewQuality.proxy
              ? PreviewQuality.full
              : PreviewQuality.proxy;
          ref.read(previewQualityProvider.notifier).state = next;
        },
        visualDensity: VisualDensity.compact,
        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
    );
  }
}
