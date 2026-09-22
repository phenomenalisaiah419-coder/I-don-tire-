import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:video_player/video_player.dart';
import '../models/timeline_models.dart';
import '../timeline/timeline_state.dart';
import '../timeline/keyframe_interpolation.dart';
import 'proxy_client.dart';
import 'preview_quality.dart';

/// Proxy-first preview surface.
///
/// Playback and scrub always prefer [MediaAsset.proxyPath] when present.
/// Full-resolution media is used only as fallback (or when proxy is missing).
/// On first encounter of media without a proxy, requests /proxy/ensure in the
/// background and switches when ready.
class PreviewPlayer extends ConsumerStatefulWidget {
  const PreviewPlayer({
    super.key,
    this.proxyClient,
  });

  final ProxyClient? proxyClient;

  @override
  ConsumerState<PreviewPlayer> createState() => _PreviewPlayerState();
}

class _PreviewPlayerState extends ConsumerState<PreviewPlayer> {
  VideoPlayerController? _controller;
  String? _currentPath;
  bool _loading = false;
  String? _error;
  Clip? _activeClip;
  Transform2D _activeTransform = Transform2D.identity;
  VoidCallback? _controllerListener;
  final Set<String> _proxyRequested = {};
  final Map<String, String> _resolvedProxy = {};
  Timer? _seekDebounce;
  int _lastSeekMs = -1;
  late final ProxyClient _proxy;

  @override
  void initState() {
    super.initState();
    _proxy = widget.proxyClient ?? ProxyClient();
  }

  void _onControllerTick() {
    final controller = _controller;
    final clip = _activeClip;
    if (controller == null || clip == null || !controller.value.isInitialized) {
      return;
    }
    final sourceMs = controller.value.position.inMilliseconds;
    final localMs =
        (sourceMs - clip.sourceInMs).clamp(0, clip.durationMs).toInt();
    final nextTransform = evaluateClipTransform(clip, localMs);
    if (mounted && nextTransform != _activeTransform) {
      setState(() => _activeTransform = nextTransform);
    }
  }

  void _attachControllerListener(VideoPlayerController controller) {
    _controllerListener = _onControllerTick;
    controller.addListener(_controllerListener!);
  }

  void _detachControllerListener(VideoPlayerController controller) {
    final listener = _controllerListener;
    if (listener != null) controller.removeListener(listener);
    _controllerListener = null;
  }

  @override
  void dispose() {
    _seekDebounce?.cancel();
    final controller = _controller;
    if (controller != null) _detachControllerListener(controller);
    controller?.dispose();
    super.dispose();
  }

  /// Prefer cached proxy, then media.proxyPath, then full-res path.
  /// Honors [PreviewQuality.full] to force full-resolution.
  String _resolvePlayPath(MediaAsset media, PreviewQuality quality) {
    if (quality == PreviewQuality.full) return media.path;
    final cached = _resolvedProxy[media.id] ?? _proxy.cachedProxyPath(media.id);
    if (cached != null && cached.isNotEmpty) return cached;
    if (media.proxyPath != null && media.proxyPath!.isNotEmpty) {
      return media.proxyPath!;
    }
    return media.path;
  }

  /// Kick off proxy generation in background if missing.
  void _ensureProxyBackground(MediaAsset media) {
    if (_proxyRequested.contains(media.id)) return;
    if (media.proxyPath != null && media.proxyPath!.isNotEmpty) return;
    if (_resolvedProxy.containsKey(media.id)) return;
    _proxyRequested.add(media.id);
    () async {
      try {
        final result = await _proxy.ensureProxy(
          mediaId: media.id,
          mediaPath: media.path,
          filmstrip: true,
        );
        final proxyPath = result['proxyPath'] as String?;
        if (proxyPath != null && proxyPath.isNotEmpty && mounted) {
          _resolvedProxy[media.id] = proxyPath;
          // Hot-swap to proxy if we are currently on full-res for this media
          if (_activeClip?.mediaId == media.id &&
              _currentPath == media.path &&
              proxyPath != media.path) {
            final ui = ref.read(timelineUiProvider);
            await _load(proxyPath);
            _seekToPlayhead(ui);
          }
        }
      } catch (_) {
        // Keep full-res; proxy is best-effort for preview fluidity
      }
    }();
  }

  Future<void> _load(String path) async {
    if (path == _currentPath && _controller != null) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    final previous = _controller;
    if (previous != null) _detachControllerListener(previous);
    await previous?.dispose();
    _controller = null;

    try {
      final file = File(path);
      if (!await file.exists()) {
        setState(() {
          _loading = false;
          _error = 'File not found:\n$path';
          _currentPath = null;
        });
        return;
      }

      final controller = VideoPlayerController.file(file);
      await controller.initialize();
      controller.setLooping(false);
      controller.setVolume(1.0);

      if (!mounted) {
        await controller.dispose();
        return;
      }

      setState(() {
        _controller = controller;
        _currentPath = path;
        _loading = false;
      });
      _attachControllerListener(controller);
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = e.toString();
          _currentPath = null;
        });
      }
    }
  }

  void _seekToPlayhead(TimelineUiState ui) {
    final active = _activeClip;
    final controller = _controller;
    if (active == null || controller == null || !controller.value.isInitialized) {
      return;
    }
    final localMs = ((ui.playheadMs - active.timelineStartMs) * active.speed)
        .round()
        .clamp(0, active.durationMs)
        .toInt();
    final sourceMs = active.sourceInMs + localMs;
    if ((sourceMs - _lastSeekMs).abs() < 40) return; // skip micro seeks
    _lastSeekMs = sourceMs;

    _seekDebounce?.cancel();
    _seekDebounce = Timer(const Duration(milliseconds: 16), () {
      if (!mounted || _controller == null) return;
      final pos = Duration(milliseconds: sourceMs);
      if ((_controller!.value.position - pos).inMilliseconds.abs() > 60) {
        _controller!.seekTo(pos);
      }
    });
  }

  void _syncToPlayhead(Project project, TimelineUiState ui) {
    Clip? active;
    for (final track in project.tracks.reversed) {
      if (track.type != TrackType.video && track.type != TrackType.overlay) {
        continue;
      }
      for (final clip in track.clips) {
        if (ui.playheadMs >= clip.timelineStartMs &&
            ui.playheadMs < clip.timelineEndMs) {
          active = clip;
          break;
        }
      }
      if (active != null) break;
    }

    if (active == null) {
      _controller?.pause();
      if (mounted) {
        setState(() {
          _activeClip = null;
          _activeTransform = Transform2D.identity;
        });
      }
      return;
    }

    final media = project.media[active.mediaId];
    if (media == null) return;

    final quality = ref.read(previewQualityProvider);
    if (quality == PreviewQuality.proxy) {
      _ensureProxyBackground(media);
    }
    final path = _resolvePlayPath(media, quality);

    _load(path).then((_) {
      if (!mounted || _controller == null || !_controller!.value.isInitialized) {
        return;
      }
      final localMs = ((ui.playheadMs - active!.timelineStartMs) * active.speed)
          .round()
          .clamp(0, active.durationMs)
          .toInt();
      final transform = evaluateClipTransform(active, localMs);
      setState(() {
        _activeClip = active;
        _activeTransform = transform;
      });
      _seekToPlayhead(ui);

      if (ui.isPlaying && !_controller!.value.isPlaying) {
        _controller!.play();
      } else if (!ui.isPlaying && _controller!.value.isPlaying) {
        _controller!.pause();
      }
    });
  }

  bool _didInitialSync = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_didInitialSync) return;
    _didInitialSync = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _syncToPlayhead(
          ref.read(projectProvider),
          ref.read(timelineUiProvider),
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final project = ref.watch(projectProvider);
    final ui = ref.watch(timelineUiProvider);
    final quality = ref.watch(previewQualityProvider);

    // Re-sync when playhead / play state / project changes
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _syncToPlayhead(project, ui);
    });

    return ColoredBox(
      color: Colors.black,
      child: Stack(
        alignment: Alignment.center,
        children: [
          if (_controller != null && _controller!.value.isInitialized)
            AspectRatio(
              aspectRatio: _controller!.value.aspectRatio,
              child: Transform(
                alignment: Alignment(
                  (_activeTransform.anchorX * 2) - 1,
                  (_activeTransform.anchorY * 2) - 1,
                ),
                transform: Matrix4.identity()
                  ..translate(_activeTransform.x, _activeTransform.y)
                  ..rotateZ(_activeTransform.rotation)
                  ..scale(_activeTransform.scaleX, _activeTransform.scaleY),
                child: Opacity(
                  opacity: _activeTransform.opacity.clamp(0.0, 1.0),
                  child: VideoPlayer(_controller!),
                ),
              ),
            )
          else if (_loading)
            const CircularProgressIndicator(strokeWidth: 2)
          else if (_error != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                _error!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white38, fontSize: 12),
              ),
            )
          else
            const Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.play_circle_outline, size: 48, color: Colors.white24),
                SizedBox(height: 8),
                Text(
                  'Preview\nLoad clips and scrub the timeline',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white38, fontSize: 13),
                ),
              ],
            ),

          // Badge: showing proxy vs full
          if (_currentPath != null)
            Positioned(
              top: 8,
              right: 8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  quality.shortBadge,
                  style: const TextStyle(
                    color: Colors.white70,
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),

          if (_controller != null && _controller!.value.isInitialized)
            Positioned(
              bottom: 12,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: Icon(
                      ui.isPlaying ? Icons.pause_circle : Icons.play_circle,
                      color: Colors.white70,
                      size: 32,
                    ),
                    onPressed: () {
                      ref.read(timelineUiProvider.notifier).togglePlay();
                    },
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  bool _isProxyPath(String path) {
    return path.contains('_proxy') ||
        _resolvedProxy.values.contains(path) ||
        path.contains('/proxies/');
  }
}
