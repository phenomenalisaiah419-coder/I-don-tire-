import 'dart:io';
import 'package:flutter/material.dart';

/// Horizontal filmstrip / contact-sheet display for a timeline clip.
/// Uses a pre-generated strip image from ProxyManager when available.
class ClipFilmstrip extends StatelessWidget {
  const ClipFilmstrip({
    super.key,
    required this.width,
    required this.height,
    this.stripPath,
    this.thumbPath,
    this.fallbackColor = const Color(0xFF2A2A3A),
  });

  final double width;
  final double height;
  final String? stripPath;
  final String? thumbPath;
  final Color fallbackColor;

  @override
  Widget build(BuildContext context) {
    final path = stripPath ?? thumbPath;
    if (path != null && File(path).existsSync()) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(4),
        child: Image.file(
          File(path),
          width: width,
          height: height,
          fit: BoxFit.cover,
          filterQuality: FilterQuality.low,
          gaplessPlayback: true,
          errorBuilder: (_, __, ___) => _placeholder(),
        ),
      );
    }
    return _placeholder();
  }

  Widget _placeholder() {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: fallbackColor,
        borderRadius: BorderRadius.circular(4),
        gradient: LinearGradient(
          colors: [
            fallbackColor,
            fallbackColor.withValues(alpha: 0.7),
          ],
        ),
      ),
      child: const Center(
        child: Icon(Icons.movie, size: 16, color: Colors.white38),
      ),
    );
  }
}
