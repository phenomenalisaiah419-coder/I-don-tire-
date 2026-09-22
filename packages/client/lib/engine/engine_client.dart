import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/timeline_models.dart';

/// Talks to the local Phenova engine bridge (Node :8788) and can also
/// target the FastAPI backend (:8000) for /api/v1 routes when needed.
class EngineClient {
  final String baseUrl;
  final String? apiBase; // optional FastAPI e.g. http://127.0.0.1:8000

  EngineClient({
    this.baseUrl = 'http://127.0.0.1:8788',
    this.apiBase,
  });

  Future<Map<String, dynamic>> _post(String path, Map<String, dynamic> body, {String? root}) async {
    final base = root ?? baseUrl;
    final res = await http
        .post(
          Uri.parse('$base$path'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode(body),
        )
        .timeout(const Duration(seconds: 60));
    final data = jsonDecode(res.body is String ? res.body : '{}');
    final map = data is Map<String, dynamic> ? data : <String, dynamic>{'data': data};
    if (res.statusCode >= 400) {
      throw Exception(map['error'] ?? map['detail'] ?? 'Engine error ${res.statusCode}');
    }
    return map;
  }

  Future<Map<String, dynamic>> _get(String path, {String? root}) async {
    final base = root ?? baseUrl;
    final res = await http.get(Uri.parse('$base$path')).timeout(const Duration(seconds: 15));
    final data = jsonDecode(res.body);
    final map = data is Map<String, dynamic> ? data : <String, dynamic>{'data': data};
    if (res.statusCode >= 400) {
      throw Exception(map['error'] ?? map['detail'] ?? 'Engine error ${res.statusCode}');
    }
    return map;
  }

  Future<bool> health() async {
    try {
      final data = await _get('/health');
      return data['ok'] == true || data['status'] == 'ok';
    } catch (_) {
      if (apiBase != null) {
        try {
          final data = await _get('/health', root: apiBase);
          return data['status'] == 'ok';
        } catch (_) {}
      }
      return false;
    }
  }

  Future<Map<String, dynamic>> getProject() => _get('/project');

  Future<void> addMedia(Map<String, dynamic> media) async {
    await _post('/media', {'media': media});
  }

  Future<Map<String, dynamic>> clarifyEdit({
    required String instruction,
    List<Map<String, dynamic>> media = const [],
    Map<String, String> answers = const {},
  }) {
    return _post('/director/clarify', {
      'instruction': instruction,
      'media': media,
      'answers': answers,
    });
  }

  Future<Map<String, dynamic>> aiEdit({
    required String instruction,
    required List<String> mediaIds,
    Map<String, dynamic>? constraints,
  }) {
    return _post('/ai/edit', {
      'instruction': instruction,
      'mediaIds': mediaIds,
      'constraints': constraints ?? {},
    });
  }

  Future<Map<String, dynamic>> aiEditAndApply({
    required String instruction,
    required List<String> mediaIds,
    Map<String, dynamic>? constraints,
  }) {
    return _post('/ai/edit-apply', {
      'instruction': instruction,
      'mediaIds': mediaIds,
      'constraints': constraints ?? {},
    });
  }

  Future<Map<String, dynamic>> applyPlan(Map<String, dynamic> plan) =>
      _post('/ai/apply', {'plan': plan});

  Future<Map<String, dynamic>> undo() => _post('/undo', {});
  Future<Map<String, dynamic>> redo() => _post('/redo', {});

  Future<void> configureDirectProvider(String apiKey) async {
    await _post('/ai/connect', {'apiKey': apiKey});
  }

  Future<Map<String, dynamic>> stockSearch({
    required String query,
    String type = 'video',
    int limit = 20,
  }) {
    return _post('/stock/search', {'query': query, 'type': type, 'limit': limit});
  }

  Future<Map<String, dynamic>> generateVideo({
    required String prompt,
    int durationSec = 4,
  }) {
    return _post('/ai/generate/video', {'prompt': prompt, 'durationSec': durationSec});
  }

  Future<Map<String, dynamic>> generateImage({required String prompt}) {
    return _post('/ai/generate/image', {'prompt': prompt});
  }

  Future<Map<String, dynamic>> exportVideo({
    String? outputPath,
    String quality = 'high',
  }) {
    return _post('/export', {
      if (outputPath != null) 'outputPath': outputPath,
      'quality': quality,
      'useFilterComplex': true,
    });
  }

  // --- Timeline ops (engine) ---
  Future<Map<String, dynamic>> setClipSpeed({required String clipId, required double speed}) =>
      _post('/clip/speed', {'clipId': clipId, 'speed': speed});

  Future<Map<String, dynamic>> reverseClip({required String clipId}) =>
      _post('/clip/reverse', {'clipId': clipId});

  Future<Map<String, dynamic>> applyEffect({
    required String clipId,
    required String effectId,
    Map<String, dynamic>? params,
  }) =>
      _post('/clip/effect', {
        'clipId': clipId,
        'effectId': effectId,
        'params': params ?? {},
      });

  Future<Map<String, dynamic>> applyTransition({
    required String clipId,
    required String transitionId,
    int durationMs = 500,
    String side = 'out',
  }) =>
      _post('/clip/transition', {
        'clipId': clipId,
        'transitionId': transitionId,
        'durationMs': durationMs,
        'side': side,
      });

  Future<Map<String, dynamic>> splitClip({
    required String clipId,
    required int atTimelineMs,
  }) =>
      _post('/clip/split', {'clipId': clipId, 'atTimelineMs': atTimelineMs});

  Future<Map<String, dynamic>> setMask({
    required String clipId,
    required String maskType, // rect | ellipse | path
    Map<String, dynamic>? params,
  }) =>
      _post('/clip/mask', {
        'clipId': clipId,
        'maskType': maskType,
        'params': params ?? {},
      });

  Future<Map<String, dynamic>> trackMotion({required String clipId}) =>
      _post('/clip/track-motion', {'clipId': clipId});

  Future<Map<String, dynamic>> removeBackground({required String clipId}) =>
      _post('/clip/bg-remove', {'clipId': clipId});

  Future<Map<String, dynamic>> addTextOverlay({
    required String text,
    int timelineStartMs = 0,
    int durationMs = 3000,
  }) =>
      _post('/text', {
        'text': text,
        'timelineStartMs': timelineStartMs,
        'durationMs': durationMs,
      });

  Future<Map<String, dynamic>> autoCaptions({required String mediaId}) =>
      _post('/captions/auto', {'mediaId': mediaId});

  /// FastAPI capabilities (when apiBase is set).
  Future<Map<String, dynamic>?> listApiCapabilities() async {
    if (apiBase == null) return null;
    try {
      return await _get('/api/v1/capabilities', root: apiBase);
    } catch (_) {
      return null;
    }
  }
}

  Future<Map<String, dynamic>> listTemplates() => _get('/templates');

  Future<Map<String, dynamic>> applyTemplate({
    required String templateId,
    List<String> mediaIds = const [],
    bool apply = true,
  }) =>
      _post('/templates/apply', {
        'templateId': templateId,
        'mediaIds': mediaIds,
        'apply': apply,
      });

  Future<Map<String, dynamic>> autoCut({
    String? mediaPath,
    String? mediaId,
    int? targetDurationMs,
    double? sensitivity,
  }) =>
      _post('/autocut', {
        if (mediaPath != null) 'mediaPath': mediaPath,
        if (mediaId != null) 'mediaId': mediaId,
        if (targetDurationMs != null) 'targetDurationMs': targetDurationMs,
        if (sensitivity != null) 'sensitivity': sensitivity,
      });

  Future<Map<String, dynamic>> asr({
    String? mediaPath,
    String? mediaId,
    String? language,
  }) =>
      _post('/asr', {
        if (mediaPath != null) 'mediaPath': mediaPath,
        if (mediaId != null) 'mediaId': mediaId,
        if (language != null) 'language': language,
      });

  Future<Map<String, dynamic>> login({required String email, String? name}) =>
      _post('/auth/login', {'email': email, if (name != null) 'name': name});


  Future<Map<String, dynamic>> generateEditPlan({
    required String instruction,
    required List<String> mediaIds,
    Map<String, dynamic>? constraints,
  }) => _post('/ai/edit-plan', {
    'instruction': instruction,
    'mediaIds': mediaIds,
    'constraints': constraints ?? {},
  });

  Future<Map<String, dynamic>> renderStatus({required String jobId}) =>
      _get('/export/$jobId');

  Future<Map<String, dynamic>> cancelRender({required String jobId}) =>
      _post('/export/$jobId/cancel', {});

  Future<Map<String, dynamic>> recoverRender({required String jobId}) =>
      _post('/export/$jobId/retry', {});

  Future<Map<String, dynamic>> entitlements() => _get('/entitlements');

Project projectFromEngineJson(Map<String, dynamic> json) {
  final tracksJson = (json['tracks'] as List?) ?? [];
  final mediaJson = (json['media'] as Map<String, dynamic>?) ?? {};

  final media = <String, MediaAsset>{};
  for (final entry in mediaJson.entries) {
    final m = entry.value as Map<String, dynamic>;
    media[entry.key] = MediaAsset(
      id: m['id'] as String? ?? entry.key,
      source: MediaSource.user(localPath: m['path'] as String?),
      type: m['type'] as String? ?? 'video',
      durationMs: (m['durationMs'] as num?)?.toInt() ?? 0,
      path: m['path'] as String? ?? '',
      width: (m['width'] as num?)?.toInt(),
      height: (m['height'] as num?)?.toInt(),
      fps: (m['fps'] as num?)?.toDouble(),
      proxyPath: m['proxyPath'] as String?,
      thumbnailPath: m['thumbnailPath'] as String?,
      qualityScore: (m['qualityScore'] as num?)?.toDouble(),
    );
  }

  final tracks = tracksJson.map((t) {
    final tj = t as Map<String, dynamic>;
    final typeStr = tj['type'] as String? ?? 'video';
    final type = TrackType.values.firstWhere(
      (e) => e.name == typeStr,
      orElse: () => TrackType.video,
    );
    final clips = ((tj['clips'] as List?) ?? []).map((c) {
      final cj = c as Map<String, dynamic>;
      return Clip(
        id: cj['id'] as String? ?? '',
        mediaId: cj['mediaId'] as String? ?? '',
        trackId: tj['id'] as String? ?? '',
        sourceInMs: (cj['sourceInMs'] as num?)?.toInt() ?? 0,
        sourceOutMs: (cj['sourceOutMs'] as num?)?.toInt() ?? 0,
        timelineStartMs: (cj['timelineStartMs'] as num?)?.toInt() ?? 0,
        speed: (cj['speed'] as num?)?.toDouble() ?? 1.0,
        reverse: cj['reverse'] as bool? ?? false,
      );
    }).toList();
    return Track(
      id: tj['id'] as String? ?? '',
      type: type,
      name: tj['name'] as String? ?? type.name,
      order: (tj['order'] as num?)?.toInt() ?? 0,
      height: type == TrackType.audio ? 48.0 : 80.0,
      clips: clips,
    );
  }).toList();

  return Project(
    id: json['id'] as String? ?? 'engine',
    name: json['name'] as String? ?? 'Project',
    settings: const ProjectSettings(),
    tracks: tracks,
    media: media,
    createdAt: DateTime.now(),
    updatedAt: DateTime.now(),
  );
}
