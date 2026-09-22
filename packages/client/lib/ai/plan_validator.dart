import 'ai_edit_plan.dart';

class PlanValidationIssue {
  final String actionId;
  final String message;
  const PlanValidationIssue(this.actionId, this.message);
}

class PlanValidationResult {
  final List<PlanValidationIssue> issues;
  const PlanValidationResult(this.issues);
  bool get isValid => issues.isEmpty;
}

class AiPlanValidator {
  const AiPlanValidator();

  PlanValidationResult validate(AiEditPlan plan) {
    final issues = <PlanValidationIssue>[];
    for (final action in plan.actions) {
      if (action.type == EditActionType.trim) {
        final start = (action.parameters['sourceInMs'] as num?)?.toInt();
        final end = (action.parameters['sourceOutMs'] as num?)?.toInt();
        if (start != null && end != null && (start < 0 || end <= start)) {
          issues.add(PlanValidationIssue(action.id, 'Trim range is invalid.'));
        }
      }
      if (action.type == EditActionType.speed) {
        final speed = (action.parameters['speed'] as num?)?.toDouble();
        if (speed != null && (speed < 0.25 || speed > 4.0)) {
          issues.add(PlanValidationIssue(action.id, 'Speed must be between 0.25x and 4x.'));
        }
      }
      if (action.type == EditActionType.volume) {
        final volume = (action.parameters['volume'] as num?)?.toDouble();
        if (volume != null && (volume < 0 || volume > 2)) {
          issues.add(PlanValidationIssue(action.id, 'Volume must be between 0 and 2.'));
        }
      }
    }
    return PlanValidationResult(issues);
  }
}
