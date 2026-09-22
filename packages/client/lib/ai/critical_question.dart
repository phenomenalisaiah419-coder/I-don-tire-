/// High-impact, pick-only clarification for ambiguous editing requests.
///
/// The detector is domain-neutral: it reasons about editing dimensions
/// (duration, subject/source, purpose, pacing, visual treatment, story focus,
/// and audio) rather than hard-coding a particular fandom or content type.
class CriticalQuestion {
  final String id;
  final String prompt;
  final List<String> options;
  final bool required;

  const CriticalQuestion({
    required this.id,
    required this.prompt,
    required this.options,
    this.required = true,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'prompt': prompt,
        'options': options,
        'required': required,
      };

  factory CriticalQuestion.fromJson(Map<String, dynamic> json) => CriticalQuestion(
        id: '${json['id'] ?? ''}',
        prompt: '${json['prompt'] ?? ''}',
        options: (json['options'] as List? ?? const []).map((e) => '$e').toList(),
        required: json['required'] != false,
      );
}

class CriticalQuestionGate {
  static List<CriticalQuestion> detect(
    String prompt, {
    List<Map<String, dynamic>> media = const [],
    Map<String, String> answers = const {},
  }) {
    final p = prompt.toLowerCase();
    final q = <CriticalQuestion>[];

    bool has(List<String> terms) => terms.any(p.contains);
    bool answered(String id) => (answers[id] ?? '').trim().isNotEmpty;

    if (!answered('duration') && !RegExp(r'\b\d+\s*(s|sec|secs|second|seconds|min|minute|minutes)\b').hasMatch(p)) {
      q.add(const CriticalQuestion(
        id: 'duration',
        prompt: 'How long should the final edit be?',
        options: ['30 seconds', '60 seconds', '90 seconds', '120 seconds'],
      ));
    }

    if (media.length > 1 && !answered('source-focus') &&
        !has(['focus on', 'best moments', 'all footage', 'use all', 'only'])) {
      q.add(const CriticalQuestion(
        id: 'source-focus',
        prompt: 'What should the edit mainly focus on?',
        options: ['Best moments across all clips', 'Tell a clear story', 'Use all footage', 'Focus on one subject'],
      ));
    }

    if (!answered('purpose') && !has(['tiktok', 'reel', 'shorts', 'social', 'music video', 'story', 'showcase', 'cinematic']) &&
        !answered('purpose')) {
      q.add(const CriticalQuestion(
        id: 'purpose',
        prompt: 'What is the main purpose of this edit?',
        options: ['Social / short-form', 'Music / beat edit', 'Story / emotional edit', 'Showcase / cinematic'],
      ));
    }

    if (!answered('pacing') && !has(['fast', 'quick', 'slow', 'emotional', 'energetic', 'beat', 'build']) &&
        !answered('pacing')) {
      q.add(const CriticalQuestion(
        id: 'pacing',
        prompt: 'What pacing do you mean?',
        options: ['Fast and energetic', 'Balanced', 'Slow and emotional', 'Build from slow to fast'],
      ));
    }

    if (!answered('visual-style') && !has(['cinematic', 'minimal', 'clean', 'dramatic', 'stylized', 'natural', 'authentic']) &&
        !answered('visual-style')) {
      q.add(const CriticalQuestion(
        id: 'visual-style',
        prompt: 'Which visual direction do you want?',
        options: ['Cinematic', 'Clean and minimal', 'Stylized / dramatic', 'Natural / authentic'],
      ));
    }

    if (!answered('story-focus') && !has(['action', 'fight', 'love', 'romance', 'emotion', 'transform', 'journey', 'personality', 'atmosphere']) &&
        !answered('story-focus')) {
      q.add(const CriticalQuestion(
        id: 'story-focus',
        prompt: 'What should viewers notice or feel most?',
        options: ['Action / energy', 'Emotion / relationships', 'Transformation / journey', 'Personality / atmosphere'],
      ));
    }

    if (!answered('audio') && !has(['music', 'song', 'instrumental', 'lyrics', 'audio', 'sound', 'beat']) &&
        !answered('audio')) {
      q.add(const CriticalQuestion(
        id: 'audio',
        prompt: 'How should audio work?',
        options: ['Beat-synced music', 'Emotional music', 'Keep original audio', 'Mix music + original audio'],
      ));
    }

    final purpose = (answers['purpose'] ?? '').toLowerCase();
    final focus = (answers['story-focus'] ?? '').toLowerCase();
    if (purpose.contains('music') && !answered('music-source')) {
      q.add(const CriticalQuestion(
        id: 'music-source',
        prompt: 'What music source should the edit use?',
        options: ['Use project music', 'Use original audio', 'Use a beat track', 'Choose later'],
      ));
    }
    if ((purpose.contains('story') || focus.contains('emotion')) && !answered('story-structure')) {
      q.add(const CriticalQuestion(
        id: 'story-structure',
        prompt: 'How should the story unfold?',
        options: ['Chronological', 'Build to a climax', 'Best moments first', 'Mood-driven / non-linear'],
      ));
    }
    if ((answers['pacing'] ?? '').toLowerCase().contains('fast') && !answered('cut-density')) {
      q.add(const CriticalQuestion(
        id: 'cut-density',
        prompt: 'How dense should the cuts feel?',
        options: ['Very punchy', 'Energetic but readable', 'Moderate', 'Let the footage decide'],
      ));
    }

    return q.take(12).toList();
  }

  static bool isComplete(
    List<CriticalQuestion> questions,
    Map<String, String> answers,
  ) {
    return questions.every((q) => !q.required || (answers[q.id] ?? '').trim().isNotEmpty);
  }

  static String buildInstruction(String prompt, Map<String, String> answers) {
    final selected = answers.entries
        .where((e) => e.value.trim().isNotEmpty)
        .map((e) => '- ${e.key}: ${e.value}')
        .join('\n');
    if (selected.isEmpty) return prompt;
    return '$prompt\n\nConfirmed choices from the user:\n$selected\n\n'
        'Treat these choices as hard creative constraints; do not replace them with guesses.';
  }
}
