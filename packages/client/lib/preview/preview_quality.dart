import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Preview playback quality.
/// - [proxy]: prefer low-res proxy (smooth scrub, CapCut-like default)
/// - [full]: force full-resolution media (slower, accurate color/detail check)
enum PreviewQuality { proxy, full }

final previewQualityProvider =
    StateProvider<PreviewQuality>((ref) => PreviewQuality.proxy);

extension PreviewQualityLabel on PreviewQuality {
  String get label => this == PreviewQuality.proxy ? 'Proxy' : 'Full';
  String get shortBadge => this == PreviewQuality.proxy ? 'PROXY' : 'FULL';
}
