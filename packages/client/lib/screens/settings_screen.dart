import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../preview/preview_quality.dart';
import '../services/media_import_service.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final quality = ref.watch(previewQualityProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        children: [
          const ListTile(
            title: Text('Account'),
            subtitle: Text('Profile and subscription'),
          ),
          const ListTile(
            title: Text('Engine'),
            subtitle: Text('http://127.0.0.1:8788'),
          ),
          const ListTile(
            title: Text('AI Providers'),
            subtitle: Text('Configured direct providers'),
          ),
          const Divider(),
          ListTile(
            title: const Text('Preview quality'),
            subtitle: Text(
              quality == PreviewQuality.proxy
                  ? 'Proxy — smooth scrub (recommended)'
                  : 'Full — original resolution',
            ),
            trailing: SegmentedButton<PreviewQuality>(
              segments: const [
                ButtonSegment(value: PreviewQuality.proxy, label: Text('Proxy')),
                ButtonSegment(value: PreviewQuality.full, label: Text('Full')),
              ],
              selected: {quality},
              onSelectionChanged: (s) {
                ref.read(previewQualityProvider.notifier).state = s.first;
              },
            ),
          ),
          ListTile(
            title: const Text('Generate missing proxies'),
            subtitle: const Text('Create proxies for all project media'),
            trailing: const Icon(Icons.high_quality),
            onTap: () async {
              final messenger = ScaffoldMessenger.of(context);
              messenger.showSnackBar(
                const SnackBar(content: Text('Generating proxies…')),
              );
              await ref.read(mediaImportServiceProvider).ensureAllProxies(filmstrip: true);
              messenger.showSnackBar(
                const SnackBar(content: Text('Proxies updated')),
              );
            },
          ),
          const Divider(),
          const ListTile(
            title: Text('About'),
            subtitle: Text('Phenova editor · proxy-first preview'),
          ),
        ],
      ),
    );
  }
}
