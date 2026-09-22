import 'package:flutter/material.dart';
import '../services/api.dart';
import 'project_screen.dart';
import 'ai_director_screen.dart';
import 'ai_generation_screen.dart';
import 'editor_screen.dart';
import 'projects_screen.dart';
import 'profile_screen.dart';
import 'settings_screen.dart';
import '../engine/engine_client.dart';

/// Phenova main shell – CapCut-like 5-tab structure with intentional differences:
/// bottom order: Edit | Templates | AI Lab | Projects | Me
/// Unique: **AI Editor** = raw manual dope editing (engine), separate from AI Lab generation.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeState();
}

class _HomeState extends State<HomeScreen> {
  final api = const PhenovaApi();
  int tab = 0; // 0 Edit, 1 Templates, 2 AI Lab, 3 Projects, 4 Me

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: tab == 0 || tab == 2 ? const Color(0xFFF5F6FA) : Colors.white,
      body: IndexedStack(
        index: tab,
        children: [
          _EditTab(
            onNewVideo: () async {
              final ok = await Navigator.push<bool>(
                context,
                MaterialPageRoute(builder: (_) => const ProjectScreen()),
              );
              if (ok == true && mounted) {
                Navigator.push(context, MaterialPageRoute(builder: (_) => const EditorScreen()));
              }
            },
            onOpenEditor: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const EditorScreen())),
            onAiEditor: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AiDirectorScreen())),
            onAiGen: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AiGenerationScreen())),
          ),
          const _TemplatesTab(),
          _AiLabTab(
            onAiEditor: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AiDirectorScreen())),
            onOpenGen: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AiGenerationScreen())),
          ),
          const ProjectsScreen(),
          ProfileScreen(api: api),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        height: 64,
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        indicatorColor: const Color(0xFF6C5CE7).withOpacity(0.12),
        selectedIndex: tab,
        onDestinationSelected: (i) => setState(() => tab = i),
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.content_cut_outlined),
            selectedIcon: Icon(Icons.content_cut, color: Color(0xFF1A1A1E)),
            label: 'Edit',
          ),
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard_rounded, color: Color(0xFF1A1A1E)),
            label: 'Templates',
          ),
          NavigationDestination(
            icon: Icon(Icons.auto_awesome_outlined),
            selectedIcon: Icon(Icons.auto_awesome, color: Color(0xFF6C5CE7)),
            label: 'AI Lab',
          ),
          NavigationDestination(
            icon: Icon(Icons.folder_outlined),
            selectedIcon: Icon(Icons.folder_rounded, color: Color(0xFF1A1A1E)),
            label: 'Projects',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline_rounded),
            selectedIcon: Icon(Icons.person_rounded, color: Color(0xFF1A1A1E)),
            label: 'Me',
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// EDIT TAB – CapCut-like “Get started” + tool grid (order differs)
// ---------------------------------------------------------------------------
class _EditTab extends StatelessWidget {
  const _EditTab({
    required this.onNewVideo,
    required this.onOpenEditor,
    required this.onAiEditor,
    required this.onAiGen,
  });

  final VoidCallback onNewVideo;
  final VoidCallback onOpenEditor;
  final VoidCallback onAiEditor;
  final VoidCallback onAiGen;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        children: [
          // Pro banner row (Phenova branded, not CapCut copy)
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(colors: [Color(0xFF6C5CE7), Color(0xFFA29BFE)]),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.diamond_outlined, color: Colors.white, size: 16),
                      SizedBox(width: 6),
                      Text('Phenova Pro', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 12)),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 10),
              IconButton(
                onPressed: () {},
                icon: const Icon(Icons.search, color: Color(0xFF1A1A1E)),
                style: IconButton.styleFrom(backgroundColor: Colors.white),
              ),
            ],
          ),
          const SizedBox(height: 20),
          const Text('Video create', style: TextStyle(color: Color(0xFF6B6B76), fontSize: 13)),
          const SizedBox(height: 4),
          Row(
            children: [
              const Text('Get started', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1E))),
              const SizedBox(width: 6),
              Icon(Icons.chevron_right, color: Colors.grey.shade600),
            ],
          ),
          const SizedBox(height: 16),
          // New video / Edit photo
          Row(
            children: [
              Expanded(
                child: _BigStartCard(
                  icon: Icons.add,
                  label: 'New video',
                  onTap: onNewVideo,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _BigStartCard(
                  icon: Icons.image_outlined,
                  label: 'Edit photo',
                  onTap: onOpenEditor,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          // Unique Phenova row: AI Editor + Open timeline
          Row(
            children: [
              Expanded(
                child: _BigStartCard(
                  icon: Icons.auto_fix_rounded,
                  label: 'AI Editor',
                  subtitle: 'Dope manual edits',
                  accent: const Color(0xFF6C5CE7),
                  onTap: onAiEditor,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _BigStartCard(
                  icon: Icons.timeline_rounded,
                  label: 'Timeline',
                  onTap: onOpenEditor,
                ),
              ),
            ],
          ),
          const SizedBox(height: 22),
          // Tool grid – labels inspired by CapCut Edit tab, order shifted
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 3,
            mainAxisSpacing: 18,
            crossAxisSpacing: 8,
            childAspectRatio: 1.05,
            children: [
              _GridTool(Icons.flash_on_outlined, 'AutoCut', () async {
                try {
                  final r = await EngineClient().autoCut(targetDurationMs: 30000);
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('AutoCut: ${(r['cuts'] as List?)?.length ?? 0} cuts (${r['method']})')),
                    );
                  }
                } catch (e) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                  }
                }
              }),
              _GridTool(Icons.create_new_folder_outlined, 'Generate\nmedia', onAiGen),
              _GridTool(Icons.face_retouching_natural, 'Retouch', () {}),
              _GridTool(Icons.auto_awesome, 'AI\ngenerator', onAiGen),
              _GridTool(Icons.photo_outlined, 'Photo tools', onOpenEditor),
              _GridTool(Icons.crop_free, 'Frame\ncapture', () {}),
              _GridTool(Icons.auto_fix, 'Auto\nenhance', () {}),
              _GridTool(Icons.closed_caption_outlined, 'Auto\ncaptions', () async {
                try {
                  final r = await EngineClient().asr();
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Captions: ${r['method']} · ${(r['captions'] as List?)?.length ?? 0} segments')),
                    );
                  }
                } catch (e) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                  }
                }
              }),
              _GridTool(Icons.wb_sunny_outlined, 'Smart\nlighting', () {}),
              _GridTool(Icons.person_off_outlined, 'Remove\nbackground', () {}),
              _GridTool(Icons.edit_outlined, 'AI photo\neditor', () {}),
              _GridTool(Icons.image_outlined, 'AI poster', () {}),
            ],
          ),
        ],
      ),
    );
  }
}

class _BigStartCard extends StatelessWidget {
  const _BigStartCard({
    required this.icon,
    required this.label,
    required this.onTap,
    this.subtitle,
    this.accent,
  });
  final IconData icon;
  final String label;
  final String? subtitle;
  final Color? accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final bg = accent?.withOpacity(0.12) ?? const Color(0xFFE8F1FF);
    final fg = accent ?? const Color(0xFF1A1A1E);
    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: SizedBox(
          height: 100,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 28, color: fg),
              const SizedBox(height: 8),
              Text(label, style: TextStyle(fontWeight: FontWeight.w700, color: fg, fontSize: 14)),
              if (subtitle != null)
                Text(subtitle!, style: TextStyle(fontSize: 10, color: fg.withOpacity(0.7))),
            ],
          ),
        ),
      ),
    );
  }
}

class _GridTool extends StatelessWidget {
  const _GridTool(this.icon, this.label, this.onTap);
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 28, color: const Color(0xFF2A2A32)),
          const SizedBox(height: 8),
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 12, height: 1.15, color: Color(0xFF2A2A32)),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// TEMPLATES TAB – feed style
// ---------------------------------------------------------------------------
class _TemplatesTab extends StatefulWidget {
  const _TemplatesTab();

  @override
  State<_TemplatesTab> createState() => _TemplatesTabState();
}

class _TemplatesTabState extends State<_TemplatesTab> {
  final _engine = EngineClient();
  List<Map<String, dynamic>> _templates = [];
  bool _loading = true;
  final chips = const ['For You', 'Pro', 'Daily life', 'Cinematic', 'Birthday'];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await _engine.listTemplates();
      final list = (data['templates'] as List?) ?? [];
      _templates = list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } catch (_) {
      _templates = [
        {'id': 'cinematic', 'title': 'Cinematic Present', 'category': 'For You'},
        {'id': 'birthday', 'title': 'Happy Birthday', 'category': 'Daily life'},
        {'id': 'wedding', 'title': 'Wedding Film', 'category': 'Pro'},
        {'id': 'travel', 'title': 'Travel Vlog', 'category': 'Daily life'},
        {'id': 'product', 'title': 'Product Ad', 'category': 'Pro'},
        {'id': 'night_city', 'title': 'Night City', 'category': 'Cinematic'},
      ];
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _apply(String id, String title) async {
    try {
      await _engine.applyTemplate(templateId: id, mediaIds: const []);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Applied: $title')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Row(
              children: [
                Expanded(
                  child: Container(
                    height: 40,
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0F1F5),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    alignment: Alignment.centerLeft,
                    child: const Text('Search Phenova', style: TextStyle(color: Color(0xFF9A9AA6))),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(onPressed: _load, icon: const Icon(Icons.refresh)),
                TextButton.icon(
                  onPressed: () {
                    Navigator.push(context, MaterialPageRoute(builder: (_) => const AiDirectorScreen()));
                  },
                  icon: const Icon(Icons.bolt, size: 18),
                  label: const Text('AI Editor'),
                ),
              ],
            ),
          ),
          SizedBox(
            height: 44,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              itemCount: chips.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                final selected = i == 0;
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: selected ? const Color(0xFF1A1A1E) : const Color(0xFFF0F1F5),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    chips[i],
                    style: TextStyle(
                      color: selected ? Colors.white : const Color(0xFF1A1A1E),
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                );
              },
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : GridView.builder(
                    padding: const EdgeInsets.all(12),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: 10,
                      crossAxisSpacing: 10,
                      childAspectRatio: 0.72,
                    ),
                    itemCount: _templates.length,
                    itemBuilder: (_, i) {
                      final t = _templates[i];
                      final title = '${t['title'] ?? t['id']}';
                      final id = '${t['id'] ?? 'cinematic'}';
                      return InkWell(
                        onTap: () => _apply(id, title),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Container(
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(12),
                                  gradient: LinearGradient(
                                    colors: [
                                      Color.lerp(const Color(0xFF1A1A2E), const Color(0xFF6C5CE7), i / 6)!,
                                      const Color(0xFF0F0F12),
                                    ],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  ),
                                ),
                                alignment: Alignment.bottomLeft,
                                padding: const EdgeInsets.all(10),
                                child: Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(title.toUpperCase(), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 11)),
                            Text('${t['category'] ?? 'Phenova'}', style: const TextStyle(color: Color(0xFF9A9AA6), fontSize: 11)),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// AI LAB – generation side + entry to AI Editor (unique)
// ---------------------------------------------------------------------------
class _AiLabTab extends StatefulWidget {
  const _AiLabTab({required this.onAiEditor, required this.onOpenGen});
  final VoidCallback onAiEditor;
  final VoidCallback onOpenGen;

  @override
  State<_AiLabTab> createState() => _AiLabTabState();
}

class _AiLabTabState extends State<_AiLabTab> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        children: [
          Row(
            children: [
              const Icon(Icons.auto_awesome, color: Color(0xFF6C5CE7)),
              const SizedBox(width: 8),
              const Text('Phenova AI', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: Color(0xFF6C5CE7))),
              const Spacer(),
              IconButton(onPressed: () {}, icon: const Icon(Icons.history)),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'Create with AI',
            style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: Color(0xFF1A1A1E), height: 1.15),
          ),
          const SizedBox(height: 6),
          const Text(
            'Generate clips, or open AI Editor for precise timeline control.',
            style: TextStyle(color: Color(0xFF6B6B76), height: 1.35),
          ),
          const SizedBox(height: 16),
          // Feature card
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 12)],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  height: 100,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: 5,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (_, i) => Container(
                      width: 72,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        color: Color.lerp(const Color(0xFF6C5CE7), const Color(0xFF00C2A8), i / 4),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                const Text('Remix & generate', style: TextStyle(fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // Mode chips – order differs from CapCut
          Wrap(
            spacing: 8,
            children: [
              _ModeChip(label: 'Phenova Gen', selected: true, onTap: widget.onOpenGen),
              _ModeChip(label: 'Image', selected: false, onTap: widget.onOpenGen),
              _ModeChip(label: 'Video', selected: false, onTap: widget.onOpenGen),
              _ModeChip(label: 'AI Editor', selected: false, highlight: true, onTap: widget.onAiEditor),
            ],
          ),
          const SizedBox(height: 16),
          // Input bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(28),
              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 16)],
            ),
            child: Row(
              children: [
                IconButton(onPressed: widget.onOpenGen, icon: const Icon(Icons.add)),
                Expanded(
                  child: TextField(
                    controller: _controller,
                    decoration: const InputDecoration(
                      hintText: 'Enter your ideas',
                      border: InputBorder.none,
                    ),
                    onSubmitted: (_) => widget.onAiEditor(),
                  ),
                ),
                IconButton(
                  onPressed: widget.onAiEditor,
                  icon: const Icon(Icons.arrow_upward_rounded, color: Colors.white),
                  style: IconButton.styleFrom(backgroundColor: const Color(0xFF1A1A1E)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const CircleAvatar(
              backgroundColor: Color(0xFFE8E6F5),
              child: Icon(Icons.auto_fix, color: Color(0xFF6C5CE7)),
            ),
            title: const Text('AI Editor', style: TextStyle(fontWeight: FontWeight.w700)),
            subtitle: const Text('Raw manual dope editing via the engine'),
            trailing: const Icon(Icons.chevron_right),
            onTap: widget.onAiEditor,
          ),
        ],
      ),
    );
  }
}

class _ModeChip extends StatelessWidget {
  const _ModeChip({required this.label, required this.selected, required this.onTap, this.highlight = false});
  final String label;
  final bool selected;
  final bool highlight;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final bg = selected
        ? const Color(0xFF1A1A1E)
        : highlight
            ? const Color(0xFFE8E6F5)
            : Colors.white;
    final fg = selected
        ? Colors.white
        : highlight
            ? const Color(0xFF6C5CE7)
            : const Color(0xFF1A1A1E);
    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Text(label, style: TextStyle(fontWeight: FontWeight.w600, color: fg, fontSize: 13)),
        ),
      ),
    );
  }
}
