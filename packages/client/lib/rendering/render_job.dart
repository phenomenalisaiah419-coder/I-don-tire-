import '../models/timeline_models.dart';

enum RenderStatus { queued, running, completed, failed, cancelled }

class RenderJob {
  final String id;
  final String projectId;
  final String outputPath;
  final String quality;
  final RenderStatus status;
  final double progress;
  final String? error;
  final DateTime createdAt;

  const RenderJob({
    required this.id,
    required this.projectId,
    required this.outputPath,
    required this.quality,
    this.status = RenderStatus.queued,
    this.progress = 0,
    this.error,
    required this.createdAt,
  });

  RenderJob copyWith({
    RenderStatus? status,
    double? progress,
    String? error,
    bool clearError = false,
  }) => RenderJob(
    id: id,
    projectId: projectId,
    outputPath: outputPath,
    quality: quality,
    status: status ?? this.status,
    progress: progress ?? this.progress,
    error: clearError ? null : (error ?? this.error),
    createdAt: createdAt,
  );

  Map<String, dynamic> toJson() => {
    'id': id, 'projectId': projectId, 'outputPath': outputPath,
    'quality': quality, 'status': status.name, 'progress': progress,
    if (error != null) 'error': error, 'createdAt': createdAt.toIso8601String(),
  };
}
