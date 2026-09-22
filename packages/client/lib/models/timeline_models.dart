/// Phenova Flutter-side timeline models.
/// Mirrors the TypeScript core types so the client stays in sync.

import 'package:equatable/equatable.dart';
import 'package:uuid/uuid.dart';

const _uuid = Uuid();

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

typedef UUID = String;
typedef Milliseconds = int;

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

enum MediaSourceKind { user, licensed, generated }

class MediaSource extends Equatable {
  final MediaSourceKind kind;
  final String? localPath;
  final String? cloudId;
  final String? provider;
  final String? assetId;
  final String? license;
  final String? model;
  final String? prompt;
  final int? seed;
  final String? jobId;

  const MediaSource.user({this.localPath, this.cloudId})
      : kind = MediaSourceKind.user,
        provider = null,
        assetId = null,
        license = null,
        model = null,
        prompt = null,
        seed = null,
        jobId = null;

  const MediaSource.licensed({
    required this.provider,
    required this.assetId,
    required this.license,
  })  : kind = MediaSourceKind.licensed,
        localPath = null,
        cloudId = null,
        model = null,
        prompt = null,
        seed = null,
        jobId = null;

  const MediaSource.generated({
    required this.model,
    required this.prompt,
    required this.jobId,
    this.seed,
  })  : kind = MediaSourceKind.generated,
        localPath = null,
        cloudId = null,
        provider = null,
        assetId = null,
        license = null;

  @override
  List<Object?> get props => [kind, localPath, cloudId, provider, assetId, jobId];
}

class MediaAsset extends Equatable {
  final UUID id;
  final MediaSource source;
  final String type; // video | audio | image
  final Milliseconds durationMs;
  final int? width;
  final int? height;
  final double? fps;
  final String path;
  final String? proxyPath;
  final String? thumbnailPath;
  final double? qualityScore;

  const MediaAsset({
    required this.id,
    required this.source,
    required this.type,
    required this.durationMs,
    required this.path,
    this.width,
    this.height,
    this.fps,
    this.proxyPath,
    this.thumbnailPath,
    this.qualityScore,
  });

  MediaAsset copyWith({
    UUID? id,
    MediaSource? source,
    String? type,
    Milliseconds? durationMs,
    int? width,
    int? height,
    double? fps,
    String? path,
    String? proxyPath,
    String? thumbnailPath,
    double? qualityScore,
  }) {
    return MediaAsset(
      id: id ?? this.id,
      source: source ?? this.source,
      type: type ?? this.type,
      durationMs: durationMs ?? this.durationMs,
      width: width ?? this.width,
      height: height ?? this.height,
      fps: fps ?? this.fps,
      path: path ?? this.path,
      proxyPath: proxyPath ?? this.proxyPath,
      thumbnailPath: thumbnailPath ?? this.thumbnailPath,
      qualityScore: qualityScore ?? this.qualityScore,
    );
  }

  @override
  List<Object?> get props => [id, path, proxyPath, thumbnailPath];
}

// ---------------------------------------------------------------------------
// Transform & Keyframes
// ---------------------------------------------------------------------------

class Transform2D extends Equatable {
  final double x;
  final double y;
  final double scaleX;
  final double scaleY;
  final double rotation;
  final double opacity;
  final double anchorX;
  final double anchorY;

  const Transform2D({
    this.x = 0,
    this.y = 0,
    this.scaleX = 1,
    this.scaleY = 1,
    this.rotation = 0,
    this.opacity = 1,
    this.anchorX = 0.5,
    this.anchorY = 0.5,
  });

  static const identity = Transform2D();

  @override
  List<Object?> get props => [x, y, scaleX, scaleY, rotation, opacity];
}

class Keyframe extends Equatable {
  final UUID id;
  final Milliseconds timeMs;
  final String property;
  final double value;
  final String easing;

  const Keyframe({
    required this.id,
    required this.timeMs,
    required this.property,
    required this.value,
    this.easing = 'easeInOut',
  });

  @override
  List<Object?> get props => [id];
}

// ---------------------------------------------------------------------------
// Effects & Transitions
// ---------------------------------------------------------------------------

class EffectInstance extends Equatable {
  final UUID id;
  final String effectId;
  final bool enabled;
  final Map<String, dynamic> params;
  final List<Keyframe> keyframes;

  const EffectInstance({
    required this.id,
    required this.effectId,
    this.enabled = true,
    this.params = const {},
    this.keyframes = const [],
  });

  @override
  List<Object?> get props => [id];
}

class TransitionInstance extends Equatable {
  final UUID id;
  final String transitionId;
  final Milliseconds durationMs;
  final Map<String, dynamic> params;
  final String easing;

  const TransitionInstance({
    required this.id,
    required this.transitionId,
    required this.durationMs,
    this.params = const {},
    this.easing = 'easeInOut',
  });

  @override
  List<Object?> get props => [id];
}

// ---------------------------------------------------------------------------
// Clips & Tracks
// ---------------------------------------------------------------------------

enum TrackType { video, audio, text, overlay, adjustment }

class TextContent extends Equatable {
  final String text;
  final String fontFamily;
  final double fontSize;
  final int fontWeight;
  final String color;
  final String? backgroundColor;
  final String alignment;

  const TextContent({
    required this.text,
    this.fontFamily = 'Inter',
    this.fontSize = 48,
    this.fontWeight = 600,
    this.color = '#FFFFFF',
    this.backgroundColor,
    this.alignment = 'center',
  });

  @override
  List<Object?> get props => [text, fontFamily, fontSize, color];
}

class Clip extends Equatable {
  final UUID id;
  final UUID mediaId;
  final UUID trackId;
  final Milliseconds sourceInMs;
  final Milliseconds sourceOutMs;
  final Milliseconds timelineStartMs;
  final double speed;
  final bool reverse;
  final Transform2D transform;
  final List<Keyframe> keyframes;
  final List<EffectInstance> effects;
  final double volume;
  final bool muted;
  final TextContent? text;
  final TransitionInstance? transitionIn;
  final TransitionInstance? transitionOut;
  final bool locked;

  const Clip({
    required this.id,
    required this.mediaId,
    required this.trackId,
    required this.sourceInMs,
    required this.sourceOutMs,
    required this.timelineStartMs,
    this.speed = 1.0,
    this.reverse = false,
    this.transform = Transform2D.identity,
    this.keyframes = const [],
    this.effects = const [],
    this.volume = 1.0,
    this.muted = false,
    this.text,
    this.transitionIn,
    this.transitionOut,
    this.locked = false,
  });

  Milliseconds get durationMs {
    final raw = sourceOutMs - sourceInMs;
    return (raw / speed).round();
  }

  Milliseconds get timelineEndMs => timelineStartMs + durationMs;

  Clip copyWith({
    Milliseconds? sourceInMs,
    Milliseconds? sourceOutMs,
    Milliseconds? timelineStartMs,
    double? speed,
    bool? reverse,
    Transform2D? transform,
    List<EffectInstance>? effects,
    List<Keyframe>? keyframes,
    double? volume,
    bool? muted,
    TransitionInstance? transitionIn,
    TransitionInstance? transitionOut,
    bool? locked,
  }) {
    return Clip(
      id: id,
      mediaId: mediaId,
      trackId: trackId,
      sourceInMs: sourceInMs ?? this.sourceInMs,
      sourceOutMs: sourceOutMs ?? this.sourceOutMs,
      timelineStartMs: timelineStartMs ?? this.timelineStartMs,
      speed: speed ?? this.speed,
      reverse: reverse ?? this.reverse,
      transform: transform ?? this.transform,
      keyframes: keyframes ?? this.keyframes,
      effects: effects ?? this.effects,
      volume: volume ?? this.volume,
      muted: muted ?? this.muted,
      text: text,
      transitionIn: transitionIn ?? this.transitionIn,
      transitionOut: transitionOut ?? this.transitionOut,
      locked: locked ?? this.locked,
    );
  }

  @override
  List<Object?> get props => [id];
}

class Track extends Equatable {
  final UUID id;
  final TrackType type;
  final String name;
  final int order;
  final bool muted;
  final bool locked;
  final bool visible;
  final double height;
  final List<Clip> clips;

  const Track({
    required this.id,
    required this.type,
    required this.name,
    required this.order,
    this.muted = false,
    this.locked = false,
    this.visible = true,
    this.height = 80,
    this.clips = const [],
  });

  Track copyWith({
    String? name,
    bool? muted,
    bool? locked,
    bool? visible,
    double? height,
    List<Clip>? clips,
  }) {
    return Track(
      id: id,
      type: type,
      name: name ?? this.name,
      order: order,
      muted: muted ?? this.muted,
      locked: locked ?? this.locked,
      visible: visible ?? this.visible,
      height: height ?? this.height,
      clips: clips ?? this.clips,
    );
  }

  @override
  List<Object?> get props => [id, clips];
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

class ProjectSettings extends Equatable {
  final int width;
  final int height;
  final double fps;
  final int sampleRate;
  final Milliseconds durationMs;
  final String backgroundColor;

  const ProjectSettings({
    this.width = 1080,
    this.height = 1920,
    this.fps = 30,
    this.sampleRate = 48000,
    this.durationMs = 0,
    this.backgroundColor = '#000000',
  });

  @override
  List<Object?> get props => [width, height, fps, durationMs];
}

class Project extends Equatable {
  final UUID id;
  final String name;
  final ProjectSettings settings;
  final List<Track> tracks;
  final Map<UUID, MediaAsset> media;
  final DateTime createdAt;
  final DateTime updatedAt;

  const Project({
    required this.id,
    required this.name,
    required this.settings,
    required this.tracks,
    required this.media,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Project.empty(String name) {
    final now = DateTime.now();
    return Project(
      id: _uuid.v4(),
      name: name,
      settings: const ProjectSettings(),
      tracks: [
        Track(id: _uuid.v4(), type: TrackType.video, name: 'Video 1', order: 0),
        Track(id: _uuid.v4(), type: TrackType.audio, name: 'Audio 1', order: 0, height: 48),
      ],
      media: {},
      createdAt: now,
      updatedAt: now,
    );
  }

  Milliseconds get computedDuration {
    var max = 0;
    for (final track in tracks) {
      for (final clip in track.clips) {
        if (clip.timelineEndMs > max) max = clip.timelineEndMs;
      }
    }
    return max;
  }

  @override
  List<Object?> get props => [id, tracks, media];
}
