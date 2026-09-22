enum EditActionType {
  trim, split, speed, volume, mute, textOverlay, transition, effect, caption
}

class EditAction {
  final String id;
  final EditActionType type;
  final String? clipId;
  final int? atMs;
  final Map<String, dynamic> parameters;

  const EditAction({
    required this.id,
    required this.type,
    this.clipId,
    this.atMs,
    this.parameters = const {},
  });

  factory EditAction.fromJson(Map<String, dynamic> json) => EditAction(
    id: '${json['id'] ?? 'action-${json.hashCode}'}',
    type: EditActionType.values.firstWhere(
      (v) => v.name == json['type'], orElse: () => EditActionType.effect),
    clipId: json['clipId'] as String?,
    atMs: (json['atMs'] as num?)?.toInt(),
    parameters: Map<String, dynamic>.from(json['parameters'] as Map? ?? const {}),
  );

  Map<String, dynamic> toJson() => {
    'id': id, 'type': type.name, if (clipId != null) 'clipId': clipId,
    if (atMs != null) 'atMs': atMs, 'parameters': parameters,
  };
}

class AiEditPlan {
  final String id;
  final String instruction;
  final List<EditAction> actions;
  final List<String> warnings;
  final double confidence;
  final String? provider;
  final DateTime createdAt;

  const AiEditPlan({
    required this.id,
    required this.instruction,
    required this.actions,
    this.warnings = const [],
    this.confidence = 0,
    this.provider,
    required this.createdAt,
  });

  factory AiEditPlan.fromJson(Map<String, dynamic> json) => AiEditPlan(
    id: '${json['id'] ?? 'plan-${json.hashCode}'}',
    instruction: '${json['instruction'] ?? ''}',
    actions: (json['actions'] as List? ?? const [])
      .whereType<Map>().map((e) => EditAction.fromJson(Map<String, dynamic>.from(e))).toList(),
    warnings: (json['warnings'] as List? ?? const []).map((e) => '$e').toList(),
    confidence: (json['confidence'] as num?)?.toDouble() ?? 0,
    provider: json['provider'] as String?,
    createdAt: DateTime.tryParse('${json['createdAt'] ?? ''}') ?? DateTime.now(),
  );

  Map<String, dynamic> toJson() => {
    'id': id, 'instruction': instruction,
    'actions': actions.map((a) => a.toJson()).toList(),
    'warnings': warnings, 'confidence': confidence, 'provider': provider,
    'createdAt': createdAt.toIso8601String(),
  };
}
