import 'dart:convert';
import 'package:http/http.dart' as http;

/// API client for Home / Projects / Profile.
/// Talks to the Phenova engine bridge (default :8788). Offline-safe.
class PhenovaApi {
  final String baseUrl;
  const PhenovaApi({this.baseUrl = 'http://127.0.0.1:8788'});

  Future<List<dynamic>> projects() async {
    try {
      final res = await http
          .get(Uri.parse('$baseUrl/projects'))
          .timeout(const Duration(seconds: 3));
      if (res.statusCode >= 400) return [];
      final data = jsonDecode(res.body);
      if (data is List) return data;
      if (data is Map && data['projects'] is List) return data['projects'] as List;
      return [];
    } catch (_) {
      return [];
    }
  }

  Future<Map<String, dynamic>?> health() async {
    try {
      final res = await http
          .get(Uri.parse('$baseUrl/health'))
          .timeout(const Duration(seconds: 2));
      if (res.statusCode >= 400) return null;
      return jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  Future<void> logout() async {}
}
