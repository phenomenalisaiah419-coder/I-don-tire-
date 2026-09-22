import 'package:flutter/material.dart';
import 'editor_screen.dart';
import 'project_screen.dart';
import '../services/api.dart';

class ProjectsScreen extends StatefulWidget {
  const ProjectsScreen({super.key});

  @override
  State<ProjectsScreen> createState() => _ProjectsScreenState();
}

class _ProjectsScreenState extends State<ProjectsScreen> {
  final api = const PhenovaApi();
  List<dynamic> projects = [];
  bool loading = true;
  int filter = 0; // 0 All, 1 Video, 2 Photo

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      projects = await api.projects();
    } catch (_) {
      projects = [];
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filters = ['All', 'Video', 'Photo', 'Templates'];
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 8, 0),
              child: Row(
                children: [
                  const Text('Projects', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
                  const Spacer(),
                  IconButton(onPressed: () {}, icon: const Icon(Icons.search)),
                  IconButton(onPressed: () {}, icon: const Icon(Icons.more_horiz)),
                ],
              ),
            ),
            // Create AI character-style banner
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Material(
                color: const Color(0xFFF0F1F5),
                borderRadius: BorderRadius.circular(14),
                child: ListTile(
                  leading: const CircleAvatar(
                    backgroundColor: Colors.white,
                    child: Icon(Icons.person_outline),
                  ),
                  title: const Text('Create AI character', style: TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: const Text('Star yourself in videos', style: TextStyle(fontSize: 12)),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {},
                ),
              ),
            ),
            // Tabs Local / Spaces / Media / Trash – simplified
            SizedBox(
              height: 40,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  for (final t in ['Local', 'Spaces', 'Media', 'Trash'])
                    Padding(
                      padding: const EdgeInsets.only(right: 16),
                      child: Text(
                        t,
                        style: TextStyle(
                          fontWeight: t == 'Local' ? FontWeight.w800 : FontWeight.w500,
                          color: t == 'Local' ? const Color(0xFF1A1A1E) : const Color(0xFF9A9AA6),
                          fontSize: 15,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            SizedBox(
              height: 40,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: filters.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, i) {
                  final sel = filter == i;
                  return ChoiceChip(
                    label: Text(filters[i]),
                    selected: sel,
                    onSelected: (_) => setState(() => filter = i),
                    selectedColor: const Color(0xFF1A1A1E),
                    labelStyle: TextStyle(color: sel ? Colors.white : const Color(0xFF1A1A1E), fontSize: 13),
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
              child: Text(
                loading ? '…' : '${projects.length} projects',
                style: const TextStyle(color: Color(0xFF6B6B76), fontSize: 13),
              ),
            ),
            Expanded(
              child: loading
                  ? const Center(child: CircularProgressIndicator())
                  : projects.isEmpty
                      ? const Center(child: Text('No projects yet', style: TextStyle(color: Color(0xFF9A9AA6))))
                      : ListView.builder(
                          itemCount: projects.length,
                          itemBuilder: (_, i) {
                            final p = projects[i];
                            final name = '${p['name'] ?? p['title'] ?? 'Project'}';
                            return ListTile(
                              leading: Container(
                                width: 56,
                                height: 56,
                                decoration: BoxDecoration(
                                  color: const Color(0xFF1A1A1E),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Icon(Icons.movie_outlined, color: Colors.white54),
                              ),
                              title: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
                              subtitle: Text('${p['updatedAt'] ?? ''}', style: const TextStyle(fontSize: 12, color: Color(0xFF9A9AA6))),
                              trailing: const Icon(Icons.more_vert, size: 18),
                              onTap: () {
                                Navigator.push(context, MaterialPageRoute(builder: (_) => const EditorScreen()));
                              },
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final ok = await Navigator.push<bool>(
            context,
            MaterialPageRoute(builder: (_) => const ProjectScreen()),
          );
          if (ok == true && mounted) {
            Navigator.push(context, MaterialPageRoute(builder: (_) => const EditorScreen()));
            _load();
          }
        },
        backgroundColor: const Color(0xFF00C2A8),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('Create'),
      ),
    );
  }
}
