import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../models/timeline_models.dart';

const _uuid = Uuid();

/// Playhead + zoom + selection state for the timeline UI.
class TimelineUiState {
  final Milliseconds playheadMs;
  final double pixelsPerMs;
  final UUID? selectedClipId;
  final UUID? selectedTrackId;
  final bool isPlaying;

  const TimelineUiState({
    this.playheadMs = 0,
    this.pixelsPerMs = 0.05, // 50 px per second
    this.selectedClipId,
    this.selectedTrackId,
    this.isPlaying = false,
  });

  TimelineUiState copyWith({
    Milliseconds? playheadMs,
    double? pixelsPerMs,
    UUID? selectedClipId,
    UUID? selectedTrackId,
    bool? isPlaying,
    bool clearSelectedClip = false,
  }) {
    return TimelineUiState(
      playheadMs: playheadMs ?? this.playheadMs,
      pixelsPerMs: pixelsPerMs ?? this.pixelsPerMs,
      selectedClipId: clearSelectedClip ? null : (selectedClipId ?? this.selectedClipId),
      selectedTrackId: selectedTrackId ?? this.selectedTrackId,
      isPlaying: isPlaying ?? this.isPlaying,
    );
  }
}

class TimelineUiNotifier extends StateNotifier<TimelineUiState> {
  TimelineUiNotifier() : super(const TimelineUiState());

  void setPlayhead(Milliseconds ms) {
    state = state.copyWith(playheadMs: ms.clamp(0, 1 << 30).toInt());
  }

  void setZoom(double pixelsPerMs) {
    state = state.copyWith(pixelsPerMs: pixelsPerMs.clamp(0.005, 2.0).toDouble());
  }

  void zoomIn() => setZoom(state.pixelsPerMs * 1.25);
  void zoomOut() => setZoom(state.pixelsPerMs / 1.25);

  void selectClip(UUID? clipId) {
    state = state.copyWith(selectedClipId: clipId, clearSelectedClip: clipId == null);
  }

  void selectTrack(UUID? trackId) {
    state = state.copyWith(selectedTrackId: trackId);
  }

  void togglePlay() {
    state = state.copyWith(isPlaying: !state.isPlaying);
  }
}

final timelineUiProvider =
    StateNotifierProvider<TimelineUiNotifier, TimelineUiState>((ref) {
  return TimelineUiNotifier();
});

/// Project state held on the client.
class ProjectNotifier extends StateNotifier<Project> {
  ProjectNotifier() : super(Project.empty('Untitled'));

  final List<Project> _undoStack = <Project>[];
  final List<Project> _redoStack = <Project>[];

  bool get canUndo => _undoStack.isNotEmpty;
  bool get canRedo => _redoStack.isNotEmpty;

  void load(Project project) {
    _undoStack.clear();
    _redoStack.clear();
    state = project;
  }

  void _commit(Project next) {
    _undoStack.add(state);
    if (_undoStack.length > 100) _undoStack.removeAt(0);
    _redoStack.clear();
    state = next;
  }

  void undo() {
    if (_undoStack.isEmpty) return;
    _redoStack.add(state);
    state = _undoStack.removeLast();
  }

  void redo() {
    if (_redoStack.isEmpty) return;
    _undoStack.add(state);
    state = _redoStack.removeLast();
  }

  void addMedia(MediaAsset media) {
    final next = Map<UUID, MediaAsset>.from(state.media)..[media.id] = media;
    _commit(Project(
      id: state.id,
      name: state.name,
      settings: state.settings,
      tracks: state.tracks,
      media: next,
      createdAt: state.createdAt,
      updatedAt: DateTime.now(),
    ));
  }


  /// Update media metadata (e.g. after proxy generation completes).
  void updateMedia(UUID mediaId, MediaAsset Function(MediaAsset m) fn) {
    final existing = state.media[mediaId];
    if (existing == null) return;
    final next = Map<UUID, MediaAsset>.from(state.media);
    next[mediaId] = fn(existing);
    _commit(Project(
      id: state.id,
      name: state.name,
      settings: state.settings,
      tracks: state.tracks,
      media: next,
      createdAt: state.createdAt,
      updatedAt: DateTime.now(),
    ));
  }

  void addClip({
    required UUID mediaId,
    required UUID trackId,
    required Milliseconds timelineStartMs,
    required Milliseconds sourceInMs,
    required Milliseconds sourceOutMs,
  }) {
    final clip = Clip(
      id: _uuid.v4(),
      mediaId: mediaId,
      trackId: trackId,
      sourceInMs: sourceInMs,
      sourceOutMs: sourceOutMs,
      timelineStartMs: timelineStartMs,
    );

    final tracks = state.tracks.map((t) {
      if (t.id != trackId) return t;
      final clips = [...t.clips, clip]..sort((a, b) => a.timelineStartMs.compareTo(b.timelineStartMs));
      return t.copyWith(clips: clips);
    }).toList();

    _commit(Project(
      id: state.id,
      name: state.name,
      settings: state.settings,
      tracks: tracks,
      media: state.media,
      createdAt: state.createdAt,
      updatedAt: DateTime.now(),
    ));
  }

  /// Applies a clip mutation only when the clip exists.
  /// The updated track is re-sorted so timeline order remains deterministic.
  bool updateClip(UUID clipId, Clip Function(Clip) updater) {
    var changed = false;
    final tracks = state.tracks.map((t) {
      final idx = t.clips.indexWhere((c) => c.id == clipId);
      if (idx < 0) return t;
      changed = true;
      final clips = List<Clip>.from(t.clips);
      clips[idx] = updater(clips[idx]);
      clips.sort((a, b) => a.timelineStartMs.compareTo(b.timelineStartMs));
      return t.copyWith(clips: clips);
    }).toList();

    if (!changed) return false;
    _commit(Project(
      id: state.id,
      name: state.name,
      settings: state.settings,
      tracks: tracks,
      media: state.media,
      createdAt: state.createdAt,
      updatedAt: DateTime.now(),
    ));
    return true;
  }

  /// Trims the beginning of a clip while keeping its timeline end fixed.
  /// The requested source-in must remain strictly before sourceOutMs.
  bool trimClipStart(UUID clipId, Milliseconds newSourceInMs) {
    for (final track in state.tracks) {
      final index = track.clips.indexWhere((c) => c.id == clipId);
      if (index < 0) continue;
      final clip = track.clips[index];
      if (clip.locked ||
          clip.speed <= 0 ||
          newSourceInMs < clip.sourceInMs ||
          newSourceInMs >= clip.sourceOutMs) {
        return false;
      }
      final removedSourceMs = newSourceInMs - clip.sourceInMs;
      if (removedSourceMs <= 0) return false;
      final nextStart = clip.timelineStartMs + (removedSourceMs / clip.speed).round();
      final nextClip = clip.copyWith(
        sourceInMs: newSourceInMs,
        timelineStartMs: nextStart,
      );
      final clips = List<Clip>.from(track.clips)
        ..[index] = nextClip
        ..sort((a, b) => a.timelineStartMs.compareTo(b.timelineStartMs));
      _commit(Project(
        id: state.id,
        name: state.name,
        settings: state.settings,
        tracks: state.tracks.map((t) => t.id == track.id ? t.copyWith(clips: clips) : t).toList(),
        media: state.media,
        createdAt: state.createdAt,
        updatedAt: DateTime.now(),
      ));
      return true;
    }
    return false;
  }

  /// Trims the end of a clip while keeping its timeline start fixed.
  bool trimClipEnd(UUID clipId, Milliseconds newSourceOutMs) {
    for (final track in state.tracks) {
      final index = track.clips.indexWhere((c) => c.id == clipId);
      if (index < 0) continue;
      final clip = track.clips[index];
      if (clip.locked ||
          newSourceOutMs <= clip.sourceInMs ||
          newSourceOutMs > clip.sourceOutMs) {
        return false;
      }
      if (newSourceOutMs == clip.sourceOutMs) return false;
      final nextClip = clip.copyWith(sourceOutMs: newSourceOutMs);
      final clips = List<Clip>.from(track.clips)
        ..[index] = nextClip
        ..sort((a, b) => a.timelineStartMs.compareTo(b.timelineStartMs));
      _commit(Project(
        id: state.id,
        name: state.name,
        settings: state.settings,
        tracks: state.tracks.map((t) => t.id == track.id ? t.copyWith(clips: clips) : t).toList(),
        media: state.media,
        createdAt: state.createdAt,
        updatedAt: DateTime.now(),
      ));
      return true;
    }
    return false;
  }

  /// Splits a clip at a timeline position, preserving source timing and effects.
  /// The position must fall strictly inside the clip's timeline range.
  bool splitClipAt(UUID clipId, Milliseconds timelinePositionMs) {
    for (final track in state.tracks) {
      final index = track.clips.indexWhere((c) => c.id == clipId);
      if (index < 0) continue;
      final clip = track.clips[index];
      if (timelinePositionMs <= clip.timelineStartMs ||
          timelinePositionMs >= clip.timelineEndMs) return false;

      final leftDuration = timelinePositionMs - clip.timelineStartMs;
      final sourceSplit = clip.sourceInMs + (leftDuration * clip.speed).round();
      if (sourceSplit <= clip.sourceInMs || sourceSplit >= clip.sourceOutMs) return false;

      final left = clip.copyWith(sourceOutMs: sourceSplit);
      final right = Clip(
        id: _uuid.v4(),
        mediaId: clip.mediaId,
        trackId: clip.trackId,
        sourceInMs: sourceSplit,
        sourceOutMs: clip.sourceOutMs,
        timelineStartMs: timelinePositionMs,
        speed: clip.speed,
        reverse: clip.reverse,
        transform: clip.transform,
        keyframes: clip.keyframes,
        effects: clip.effects,
        volume: clip.volume,
        muted: clip.muted,
        text: clip.text,
        transitionIn: clip.transitionIn,
        transitionOut: clip.transitionOut,
        locked: clip.locked,
      );
      final clips = List<Clip>.from(track.clips)
        ..removeAt(index)
        ..addAll([left, right])
        ..sort((a, b) => a.timelineStartMs.compareTo(b.timelineStartMs));
      final tracks = state.tracks
          .map((t) => t.id == track.id ? t.copyWith(clips: clips) : t)
          .toList();
      _commit(Project(
        id: state.id,
        name: state.name,
        settings: state.settings,
        tracks: tracks,
        media: state.media,
        createdAt: state.createdAt,
        updatedAt: DateTime.now(),
      ));
      return true;
    }
    return false;
  }

  /// Adds or replaces a clip keyframe, keeping keyframes ordered by time.
  bool upsertClipKeyframe(UUID clipId, Keyframe keyframe) {
    return updateClip(clipId, (clip) {
      final frames = List<Keyframe>.from(clip.keyframes)
        ..removeWhere((f) => f.property == keyframe.property && f.timeMs == keyframe.timeMs)
        ..add(keyframe);
      frames.sort((a, b) => a.timeMs.compareTo(b.timeMs));
      return clip.copyWith(keyframes: frames);
    });
  }

  /// Removes a keyframe by ID without affecting other clip properties.
  bool removeClipKeyframe(UUID clipId, UUID keyframeId) {
    return updateClip(clipId, (clip) {
      return clip.copyWith(
        keyframes: clip.keyframes.where((f) => f.id != keyframeId).toList(),
      );
    });
  }

  /// Updates a clip's transform through the same undoable commit path.
  bool updateClipTransform(UUID clipId, Transform2D transform) {
    return updateClip(clipId, (clip) => clip.copyWith(transform: transform));
  }

  /// Changes playback speed while preserving the clip's timeline start.
  /// The bounded range prevents invalid engine requests and unusable durations.
  bool setClipSpeed(UUID clipId, double speed) {
    if (!speed.isFinite || speed < 0.25 || speed > 4.0) return false;
    return updateClip(clipId, (clip) => clip.copyWith(speed: speed));
  }

  /// Toggles clip audio without mutating unrelated clip properties.
  bool toggleClipMute(UUID clipId) {
    return updateClip(clipId, (clip) => clip.copyWith(muted: !clip.muted));
  }

  /// Removes a clip only when it exists, avoiding false undo history entries.
  bool removeClip(UUID clipId) {
    final exists = state.tracks.any((t) => t.clips.any((c) => c.id == clipId));
    if (!exists) return false;

    final tracks = state.tracks.map((t) {
      return t.copyWith(clips: t.clips.where((c) => c.id != clipId).toList());
    }).toList();

    _commit(Project(
      id: state.id,
      name: state.name,
      settings: state.settings,
      tracks: tracks,
      media: state.media,
      createdAt: state.createdAt,
      updatedAt: DateTime.now(),
    ));
    return true;
  }

  void addTrack(TrackType type, String name) {
    final track = Track(
      id: _uuid.v4(),
      type: type,
      name: name,
      order: state.tracks.length,
      height: type == TrackType.audio ? 48 : 80,
    );
    _commit(Project(
      id: state.id,
      name: state.name,
      settings: state.settings,
      tracks: [...state.tracks, track],
      media: state.media,
      createdAt: state.createdAt,
      updatedAt: DateTime.now(),
    ));
  }
}

final projectProvider = StateNotifierProvider<ProjectNotifier, Project>((ref) {
  return ProjectNotifier();
});


/// Lightweight playhead tick for high-frequency scrub without rebuilding tracks.
/// Timeline body watches [projectProvider]; playhead line watches this.
final playheadMsProvider = StateProvider<int>((ref) => 0);

/// Sync helper: call from UI when playhead moves so both providers stay aligned.
void syncPlayhead(dynamic ref, int ms) {
  ref.read(timelineUiProvider.notifier).setPlayhead(ms);
  ref.read(playheadMsProvider.notifier).state = ms;
}
