import 'package:flutter/material.dart';

/// Opens the multi-track editor workspace.
class ProjectScreen extends StatelessWidget {
  final String? projectId;
  const ProjectScreen({super.key, this.projectId});

  @override
  Widget build(BuildContext context) {
    // Deferred import path: push MaterialPageRoute to EditorShell from caller,
    // or use a simple embedded scaffold that tells user to use Home → New Project flow.
    return Scaffold(
      appBar: AppBar(title: Text(projectId == null ? 'New Project' : 'Project')),
      body: Center(
        child: FilledButton(
          onPressed: () {
            // Pop with true so Home reloads; actual editor is opened from Home navigation.
            Navigator.pop(context, true);
          },
          child: const Text('Create & open editor'),
        ),
      ),
    );
  }
}
