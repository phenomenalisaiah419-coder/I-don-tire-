import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/timeline_models.dart';
import '../preview/proxy_client.dart';
import '../timeline/timeline_state.dart';

/// Import pipeline: add media to project, then auto-generate proxy/thumb/filmstrip.
class MediaImportService {
  MediaImportService({
    required this.ref,
    ProxyClient? proxyClient,
  }) : _proxy = proxyClient ?? ProxyClient();

  final Ref ref;
  final ProxyClient _proxy;

  /// Register media and kick off proxy generation in the background.
  /// Returns the media id. Proxy paths are written back via [updateMedia].
  Future<String> importAndProxy(MediaAsset media, {bool filmstrip = true}) async {
    ref.read(projectProvider.notifier).addMedia(media);
    if (media.type == 'audio') return media.id;
    await _runProxy(media, filmstrip: filmstrip);
    return media.id;
  }

  /// Add media immediately; generate proxy in the background (non-blocking UI).
  String importAndProxyAsync(MediaAsset media, {bool filmstrip = true}) {
    ref.read(projectProvider.notifier).addMedia(media);
    if (media.type != 'audio') {
      // Fire-and-forget
      _runProxy(media, filmstrip: filmstrip);
    }
    return media.id;
  }

  Future<void> _runProxy(MediaAsset media, {bool filmstrip = true}) async {
    try {
      final result = await _proxy.ensureProxy(
        mediaId: media.id,
        mediaPath: media.path,
        filmstrip: filmstrip,
      );
      final proxyPath = result['proxyPath'] as String?;
      final thumb = result['thumbnailPath'] as String?;
      if (proxyPath != null || thumb != null) {
        ref.read(projectProvider.notifier).updateMedia(media.id, (m) {
          return m.copyWith(
            proxyPath: proxyPath ?? m.proxyPath,
            thumbnailPath: thumb ?? m.thumbnailPath,
          );
        });
      }
    } catch (_) {
      // Import still succeeds without proxy; preview falls back to full-res
    }
  }

  /// Ensure proxies for all project media missing proxyPath.
  Future<void> ensureAllProxies({bool filmstrip = false}) async {
    final project = ref.read(projectProvider);
    final missing = project.media.values
        .where((m) => m.type != 'audio' && (m.proxyPath == null || m.proxyPath!.isEmpty))
        .map((m) => {'mediaId': m.id, 'mediaPath': m.path})
        .toList();
    if (missing.isEmpty) return;
    try {
      final results = await _proxy.ensureProxies(missing, filmstrip: filmstrip);
      for (final r in results) {
        final id = r['mediaId'] as String? ?? '';
        // batch may not echo mediaId — match by path
        final proxyPath = r['proxyPath'] as String?;
        final thumb = r['thumbnailPath'] as String?;
        if (proxyPath == null) continue;
        for (final m in project.media.values) {
          if (m.path == (r['mediaPath'] as String?) || m.id == id) {
            ref.read(projectProvider.notifier).updateMedia(m.id, (x) {
              return x.copyWith(
                proxyPath: proxyPath,
                thumbnailPath: thumb ?? x.thumbnailPath,
              );
            });
          }
        }
      }
    } catch (_) {}
  }
}

final mediaImportServiceProvider = Provider<MediaImportService>((ref) {
  return MediaImportService(ref: ref);
});
