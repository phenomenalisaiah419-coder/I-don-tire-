import 'package:flutter/material.dart';

class ExploreScreen extends StatelessWidget {
  const ExploreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Explore', style: TextStyle(fontWeight: FontWeight.w800)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: const [
          Text('Discover', style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800)),
          SizedBox(height: 6),
          Text('Templates, creative resources, and inspiration.', style: TextStyle(color: Colors.white60)),
          SizedBox(height: 24),
          _ExploreCard(icon: Icons.grid_view_rounded, title: 'Templates', subtitle: 'Ready-made styles for your next edit.'),
          SizedBox(height: 12),
          _ExploreCard(icon: Icons.auto_awesome_rounded, title: 'AI Creation', subtitle: 'Turn ideas, prompts, and media into creative starting points.'),
          SizedBox(height: 12),
          _ExploreCard(icon: Icons.public_rounded, title: 'Creative Resources', subtitle: 'Explore new ways to build and refine your projects.'),
        ],
      ),
    );
  }
}

class _ExploreCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _ExploreCard({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        contentPadding: const EdgeInsets.all(16),
        leading: Icon(icon, size: 32),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 5),
          child: Text(subtitle),
        ),
        trailing: const Icon(Icons.chevron_right_rounded),
      ),
    );
  }
}
