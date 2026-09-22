import 'package:flutter/material.dart';
import '../engine/engine_client.dart';
import '../ai/critical_question.dart';

/// AI Editor – confirmation-style UI (CapCut / modern AI editor).
/// Not a long chat thread: show the request, a plan summary, actions, then run.
class AiDirectorScreen extends StatefulWidget {
  const AiDirectorScreen({super.key, this.initialPrompt});

  final String? initialPrompt;

  @override
  State<AiDirectorScreen> createState() => _AiDirectorScreenState();
}

enum _AdvisorPhase { idle, planning, ready, running, done, error }

class _AiDirectorScreenState extends State<AiDirectorScreen> {
  final _controller = TextEditingController();
  final _engine = EngineClient();

  _AdvisorPhase _phase = _AdvisorPhase.idle;
  String? _userRequest;
  String? _planSummary;
  String? _error;
  bool _tasksExpanded = true;
  bool _engineOnline = false;
  List<String> _tasks = const [];
  List<CriticalQuestion> _criticalQuestions = const [];
  final Map<String, String> _answers = {};

  @override
  void initState() {
    super.initState();
    if (widget.initialPrompt != null && widget.initialPrompt!.trim().isNotEmpty) {
      _controller.text = widget.initialPrompt!;
    }
    _checkHealth();
  }

  Future<void> _checkHealth() async {
    final ok = await _engine.health();
    if (mounted) setState(() => _engineOnline = ok);
  }

  Future<void> _submitIdeas() async {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _userRequest = text;
      _phase = _AdvisorPhase.planning;
      _error = null;
      _planSummary = null;
      _tasks = const [];
    });

    // Ask the real Director clarification endpoint when the engine is available.
    // The same endpoint is re-run after each answer so only consequential
    // follow-up questions remain.
    _answers.clear();
    List<CriticalQuestion> detected = await _loadCriticalQuestions(text);
    if (!mounted) return;
    _criticalQuestions = detected;
    final summary = _buildPlanSummary(text);
    final tasks = _buildTasks(text);
    setState(() {
      _planSummary = summary;
      _tasks = tasks;
      _phase = _AdvisorPhase.ready;
      _controller.clear();
    });
  }

  Future<List<CriticalQuestion>> _loadCriticalQuestions(String prompt) async {
    List<CriticalQuestion> detected = CriticalQuestionGate.detect(
      prompt,
      answers: Map<String, String>.from(_answers),
    );
    try {
      final project = await _engine.getProject();
      final raw = project['media'];
      final media = <Map<String, dynamic>>[];
      if (raw is Map) {
        for (final entry in raw.entries) {
          if (entry.value is Map) {
            media.add(Map<String, dynamic>.from(entry.value as Map));
          } else {
            media.add({'id': '${entry.key}'});
          }
        }
      } else if (raw is List) {
        for (final item in raw) {
          if (item is Map) media.add(Map<String, dynamic>.from(item));
        }
      }
      final response = await _engine.clarifyEdit(
        instruction: prompt,
        media: media,
        answers: Map<String, String>.from(_answers),
      );
      final rows = response['questions'];
      if (rows is List) {
        detected = rows
            .whereType<Map>()
            .map((row) => CriticalQuestion.fromJson(Map<String, dynamic>.from(row)))
            .where((q) => q.options.isNotEmpty)
            .toList();
      }
    } catch (_) {
      // Local detector remains the offline fallback.
    }
    return detected;
  }

  Widget _buildCriticalQuestions() {
    if (_criticalQuestions.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Important choices for your edit', style: TextStyle(fontWeight: FontWeight.bold)),
      ..._criticalQuestions.map((q) => DropdownButtonFormField<String>(
        decoration: InputDecoration(labelText: q.prompt),
        value: _answers[q.id],
        items: q.options.map((o) => DropdownMenuItem(value: o, child: Text(o))).toList(),
        onChanged: (v) async {
          if (v == null || _userRequest == null) return;
          setState(() => _answers[q.id] = v);
          final refreshed = await _loadCriticalQuestions(_userRequest!);
          if (!mounted) return;
          setState(() => _criticalQuestions = refreshed);
        },
      )),
    ]);
  }

  String _buildPlanSummary(String request) {
    final lower = request.toLowerCase();
    final bits = <String>[];
    if (lower.contains('birthday')) bits.add('birthday-focused sequence');
    if (lower.contains('ken burns') || lower.contains('zoom')) bits.add('gentle Ken Burns motion');
    if (lower.contains('slow') || lower.contains('emotional')) bits.add('slow emotional pacing');
    if (lower.contains('transition') || lower.contains('dissolve') || lower.contains('smooth')) {
      bits.add('smooth dissolves');
    }
    if (lower.contains('caption') || lower.contains('text')) bits.add('text / captions');
    if (lower.contains('chroma') || lower.contains('green')) bits.add('chroma key');
    if (bits.isEmpty) bits.add('cinematic multi-clip edit');
    final selected = _answers.values.where((v) => v.trim().isNotEmpty).toList();
    final choices = selected.isEmpty ? '' : ' Confirmed choices: ${selected.join(' • ')}.';
    return 'I\'ll create a ${bits.join(', ')} from your media, arranged in a meaningful order.$choices '
        'Each shot stays on screen long enough to land. Proceed?';
  }

  List<String> _buildTasks(String request) {
    final lower = request.toLowerCase();
    return [
      'Analyze uploaded media',
      if (lower.contains('birthday') || lower.contains('first')) 'Prioritize key stills / text cards',
      'Build timeline order',
      if (lower.contains('ken') || lower.contains('zoom') || lower.contains('motion'))
        'Apply Ken Burns / motion',
      if (lower.contains('transition') || lower.contains('smooth') || lower.contains('dissolve'))
        'Add smooth transitions',
      if (lower.contains('caption') || lower.contains('text')) 'Place text overlays',
      'Ready for render',
    ];
  }

  Future<void> _createVideo() async {
    if (_userRequest == null) return;
    setState(() {
      _phase = _AdvisorPhase.running;
      _error = null;
    });
    try {
      final healthy = await _engine.health();
      if (!healthy) {
        setState(() {
          _engineOnline = false;
          _phase = _AdvisorPhase.error;
          _error =
              'Engine offline (http://127.0.0.1:8788). Start the API/engine with PHENOVA_PROVIDER_API_KEY set.';
        });
        return;
      }
      setState(() => _engineOnline = true);

      final project = await _engine.getProject();
      final media = (project['media'] as Map?)?.keys.toList().cast<String>() ?? <String>[];
      if (media.isEmpty) {
        setState(() {
          _phase = _AdvisorPhase.error;
          _error = 'No media in the project. Import photos or clips in the editor first.';
        });
        return;
      }

      if (!CriticalQuestionGate.isComplete(_criticalQuestions, _answers)) {
        setState(() {
          _phase = _AdvisorPhase.ready;
          _error = 'Choose an answer for each important question before creating the video.';
        });
        return;
      }
      final result = await _engine.aiEditAndApply(
        instruction: CriticalQuestionGate.buildInstruction(_userRequest!, _answers),
        mediaIds: media,
        constraints: {
          'useOnlyUserFootage': true,
          'allowGeneration': false,
          'criticalAnswers': Map<String, String>.from(_answers),
        },
      );
      final steps = result['steps'] ?? result['events']?.length ?? 'ok';
      setState(() {
        _phase = _AdvisorPhase.done;
        _planSummary =
            'Edit applied ($steps steps). Open the timeline to review, or export when ready.';
      });
    } catch (e) {
      setState(() {
        _phase = _AdvisorPhase.error;
        _error = e.toString();
      });
    }
  }

  void _adjustStyle() {
    setState(() {
      _phase = _AdvisorPhase.idle;
      _controller.text = _userRequest ?? '';
      _planSummary = null;
      _tasks = const [];
      _error = null;
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bg = const Color(0xFFF2F3F7);
    final card = Colors.white;
    final ink = const Color(0xFF1A1A1E);
    final muted = const Color(0xFF6B6B76);

    return Scaffold(
      backgroundColor: bg,
      appBar: AppBar(
        backgroundColor: bg,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20, color: Color(0xFF1A1A1E)),
          onPressed: () => Navigator.maybePop(context),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.chat_bubble_outline_rounded, color: Color(0xFF1A1A1E)),
            onPressed: () {},
          ),
          IconButton(
            icon: const Icon(Icons.history_rounded, color: Color(0xFF1A1A1E)),
            onPressed: () {},
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
              children: [
                // Engine status (subtle)
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    _engineOnline ? 'Engine connected' : 'Engine offline — plans still preview locally',
                    style: TextStyle(fontSize: 11, color: muted),
                  ),
                ),
                const SizedBox(height: 12),

                // User request card
                if (_userRequest != null) ...[
                  _Bubble(
                    color: card,
                    child: Text(
                      _userRequest!,
                      style: TextStyle(fontSize: 16, height: 1.45, color: ink, fontWeight: FontWeight.w500),
                    ),
                  ),
                  const SizedBox(height: 20),
                ],

                _buildCriticalQuestions(),
                const SizedBox(height: 12),

                // Tasks completed
                if (_phase == _AdvisorPhase.ready ||
                    _phase == _AdvisorPhase.running ||
                    _phase == _AdvisorPhase.done) ...[
                  InkWell(
                    onTap: () => setState(() => _tasksExpanded = !_tasksExpanded),
                    child: Row(
                      children: [
                        Text(
                          _phase == _AdvisorPhase.done ? 'Tasks completed' : 'Tasks',
                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: ink),
                        ),
                        Icon(
                          _tasksExpanded ? Icons.expand_less : Icons.expand_more,
                          color: muted,
                        ),
                      ],
                    ),
                  ),
                  if (_tasksExpanded) ...[
                    const SizedBox(height: 8),
                    for (final t in _tasks)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6, left: 4),
                        child: Row(
                          children: [
                            Icon(
                              _phase == _AdvisorPhase.done
                                  ? Icons.check_circle
                                  : Icons.radio_button_unchecked,
                              size: 16,
                              color: _phase == _AdvisorPhase.done
                                  ? const Color(0xFF6C5CE7)
                                  : muted,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(t, style: TextStyle(fontSize: 13, color: muted)),
                            ),
                          ],
                        ),
                      ),
                  ],
                  const SizedBox(height: 16),
                ],

                // Plan summary
                if (_planSummary != null) ...[
                  Text(
                    _planSummary!,
                    style: TextStyle(fontSize: 16, height: 1.5, color: ink),
                  ),
                  const SizedBox(height: 20),
                ],

                // Planning spinner
                if (_phase == _AdvisorPhase.planning)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Center(
                      child: CircularProgressIndicator(color: Color(0xFF6C5CE7)),
                    ),
                  ),

                // Error
                if (_error != null) ...[
                  Text(_error!, style: const TextStyle(color: Colors.redAccent, height: 1.4)),
                  const SizedBox(height: 16),
                ],

                // Action buttons (screenshot style)
                if (_phase == _AdvisorPhase.ready || _phase == _AdvisorPhase.error) ...[
                  _ActionRow(
                    label: 'Create the video',
                    onTap: _createVideo,
                  ),
                  const SizedBox(height: 10),
                  _ActionRow(
                    label: 'Adjust the style first',
                    onTap: _adjustStyle,
                  ),
                ],

                if (_phase == _AdvisorPhase.running)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    child: LinearProgressIndicator(
                      color: Color(0xFF6C5CE7),
                      backgroundColor: Color(0xFFE8E6F5),
                    ),
                  ),

                if (_phase == _AdvisorPhase.done) ...[
                  _ActionRow(
                    label: 'Open timeline',
                    onTap: () => Navigator.maybePop(context),
                  ),
                  const SizedBox(height: 10),
                  _ActionRow(
                    label: 'New idea',
                    onTap: () {
                      setState(() {
                        _phase = _AdvisorPhase.idle;
                        _userRequest = null;
                        _planSummary = null;
                        _tasks = const [];
                        _error = null;
                      });
                    },
                  ),
                ],
              ],
            ),
          ),

          // Bottom input bar (screenshot style)
          Container(
            padding: EdgeInsets.only(
              left: 12,
              right: 12,
              top: 10,
              bottom: MediaQuery.of(context).padding.bottom + 10,
            ),
            decoration: const BoxDecoration(
              color: Color(0xFFF2F3F7),
            ),
            child: Row(
              children: [
                IconButton(
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Attach media from the editor Media panel')),
                    );
                  },
                  icon: const Icon(Icons.add, color: Color(0xFF1A1A1E)),
                  style: IconButton.styleFrom(
                    backgroundColor: Colors.white,
                    shape: const CircleBorder(),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(28),
                    ),
                    child: TextField(
                      controller: _controller,
                      enabled: _phase != _AdvisorPhase.running && _phase != _AdvisorPhase.planning,
                      style: const TextStyle(color: Color(0xFF1A1A1E), fontSize: 15),
                      decoration: const InputDecoration(
                        hintText: 'Enter your ideas',
                        hintStyle: TextStyle(color: Color(0xFF9A9AA6)),
                        border: InputBorder.none,
                      ),
                      minLines: 1,
                      maxLines: 3,
                      onSubmitted: (_) => _submitIdeas(),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  onPressed: (_phase == _AdvisorPhase.running || _phase == _AdvisorPhase.planning)
                      ? null
                      : _submitIdeas,
                  icon: const Icon(Icons.arrow_upward_rounded, color: Colors.white),
                  style: IconButton.styleFrom(
                    backgroundColor: const Color(0xFF1A1A1E),
                    shape: const CircleBorder(),
                    disabledBackgroundColor: const Color(0xFFB0B0B8),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.child, required this.color});
  final Widget child;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: child,
    );
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(28),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(28),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF1A1A1E),
                  ),
                ),
              ),
              const Icon(Icons.arrow_outward_rounded, size: 18, color: Color(0xFF1A1A1E)),
            ],
          ),
        ),
      ),
    );
  }
}
