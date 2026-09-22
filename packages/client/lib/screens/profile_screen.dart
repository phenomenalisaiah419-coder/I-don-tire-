import 'package:flutter/material.dart';
import '../services/api.dart';
import '../services/auth_service.dart';
import 'settings_screen.dart';
import 'ai_director_screen.dart';
import 'auth_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, required this.api});
  final PhenovaApi api;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final auth = AuthScope.instance;

  @override
  void initState() {
    super.initState();
    auth.refreshEntitlements().then((_) {
      if (mounted) setState(() {});
    });
  }

  @override
  Widget build(BuildContext context) {
    final user = auth.user;
    final name = user?['name']?.toString() ?? user?['email']?.toString() ?? 'Phenova creator';
    final plan = (auth.entitlements?['plan'] ?? user?['plan'] ?? (auth.isPro ? 'Pro' : 'Free')).toString();
    final features = (auth.entitlements?['features'] as List?)?.map((e) => e.toString()).toList() ??
        const ['ai_editor', 'masks', 'export'];

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            Row(
              children: [
                const Spacer(),
                IconButton(onPressed: () {}, icon: const Icon(Icons.notifications_outlined)),
                IconButton(
                  onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsScreen())),
                  icon: const Icon(Icons.settings_outlined),
                ),
              ],
            ),
            Row(
              children: [
                const CircleAvatar(
                  radius: 32,
                  backgroundColor: Color(0xFFB8F0E0),
                  child: Icon(Icons.person, size: 36, color: Colors.white),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18), overflow: TextOverflow.ellipsis),
                          ),
                          const SizedBox(width: 8),
                          Chip(
                            label: Text(plan, style: const TextStyle(fontSize: 11)),
                            visualDensity: VisualDensity.compact,
                            padding: EdgeInsets.zero,
                          ),
                        ],
                      ),
                      TextButton(
                        onPressed: () async {
                          if (!auth.isLoggedIn) {
                            await Navigator.push(context, MaterialPageRoute(builder: (_) => const AuthScreen()));
                            if (mounted) setState(() {});
                          }
                        },
                        style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: Size.zero, tapTargetSize: MaterialTapTargetSize.shrinkWrap),
                        child: Text(auth.isLoggedIn ? 'Signed in >' : 'Sign in >', style: const TextStyle(color: Color(0xFF6B6B76))),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFFE8E0FF), Color(0xFFD6E4FF)]),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.diamond, color: Color(0xFF6C5CE7)),
                      const SizedBox(width: 8),
                      Text(plan, style: const TextStyle(fontWeight: FontWeight.w800)),
                      const Spacer(),
                      FilledButton(
                        onPressed: () async {
                          await auth.refreshEntitlements();
                          if (mounted) setState(() {});
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Plan: $plan · features: ${features.take(4).join(", ")}')),
                          );
                        },
                        style: FilledButton.styleFrom(backgroundColor: Colors.black, visualDensity: VisualDensity.compact),
                        child: const Text('Refresh Pro'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    features.isEmpty
                        ? 'Unlock 4K export, AI Editor credits, advanced masks'
                        : 'Includes: ${features.take(6).join(", ")}',
                    style: const TextStyle(fontSize: 12, color: Color(0xFF4A4A55)),
                  ),
                  const SizedBox(height: 14),
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _ProIcon(Icons.folder_copy_outlined, 'Materials'),
                      _ProIcon(Icons.grid_view, 'Pro tools'),
                      _ProIcon(Icons.auto_awesome, 'AI effects'),
                      _ProIcon(Icons.face_retouching_natural, 'Retouch'),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            _MeTile(Icons.emoji_events_outlined, 'Events', () {}),
            _MeTile(Icons.bookmark_border, 'Likes & Favorites', () {}),
            _MeTile(Icons.history, 'View history', () {}),
            _MeTile(Icons.help_outline, 'Help Center', () {}),
            _MeTile(Icons.auto_fix, 'AI Editor', () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const AiDirectorScreen()));
            }),
            _MeTile(Icons.logout, auth.isLoggedIn ? 'Sign out' : 'Sign in', () async {
              if (auth.isLoggedIn) {
                await auth.logout();
                if (mounted) setState(() {});
              } else {
                await Navigator.push(context, MaterialPageRoute(builder: (_) => const AuthScreen()));
                if (mounted) setState(() {});
              }
            }),
          ],
        ),
      ),
    );
  }
}

class _ProIcon extends StatelessWidget {
  const _ProIcon(this.icon, this.label);
  final IconData icon;
  final String label;
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, size: 22, color: const Color(0xFF2A2A32)),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(fontSize: 11)),
      ],
    );
  }
}

class _MeTile extends StatelessWidget {
  const _MeTile(this.icon, this.title, this.onTap);
  final IconData icon;
  final String title;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon, color: const Color(0xFF2A2A32)),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w500)),
      trailing: const Icon(Icons.chevron_right, color: Color(0xFF9A9AA6)),
      onTap: onTap,
    );
  }
}
