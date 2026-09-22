import 'package:flutter/material.dart';

/// AI Generation side – templates / text-to-video ideas (CapCut-like generation shelf).
/// Distinct from AI Editor (manual dope editing via engine plans).
class AiGenerationScreen extends StatelessWidget {
  const AiGenerationScreen({super.key});

  static const _templates = [
    _GenCard('Text to video', 'Turn a prompt into clips', Icons.movie_filter_outlined, Color(0xFF7C5CFC)),
    _GenCard('Photo to video', 'Ken Burns slideshow', Icons.photo_library_outlined, Color(0xFF00C2A8)),
    _GenCard('Auto captions', 'Transcribe & style', Icons.closed_caption_outlined, Color(0xFFFF6B6B)),
    _GenCard('Beat sync', 'Cut to the music', Icons.music_note_outlined, Color(0xFFFFB020)),
    _GenCard('Style transfer', 'Cinematic look', Icons.palette_outlined, Color(0xFF4ECDC4)),
    _GenCard('AI avatars', 'Talking presenters', Icons.face_retouching_natural, Color(0xFFE056FD)),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B0B10),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0B0B10),
        title: const Text('AI Generation', style: TextStyle(fontWeight: FontWeight.w700)),
        actions: [
          TextButton.icon(
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.auto_fix_outlined, size: 18),
            label: const Text('AI Editor'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          const Text(
            'Generate new media or auto-styles. For precise timeline control, use AI Editor.',
            style: TextStyle(color: Colors.white54, height: 1.4),
          ),
          const SizedBox(height: 16),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.15,
            children: [
              for (final t in _templates)
                Material(
                  color: const Color(0xFF15151D),
                  borderRadius: BorderRadius.circular(16),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('${t.title} — wire to generation provider when enabled')),
                      );
                    },
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: t.color.withOpacity(0.2),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Icon(t.icon, color: t.color, size: 22),
                          ),
                          const Spacer(),
                          Text(t.title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                          const SizedBox(height: 4),
                          Text(t.subtitle, style: const TextStyle(color: Colors.white54, fontSize: 12)),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _GenCard {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  const _GenCard(this.title, this.subtitle, this.icon, this.color);
}
