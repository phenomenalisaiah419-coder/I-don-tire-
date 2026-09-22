import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

/// Client for server-side proxy / filmstrip / scrub-frame endpoints.
class ProxyClient {
  ProxyClient({this.baseUrl = 'http://127.0.0.1:8788'});

  final String baseUrl;
  final Map<String, String> _proxyPathCache = {};
  final Map<String, String> _thumbCache = {};

  Uri _u(String path) => Uri.parse('$baseUrl$path');

  /// Ensure proxy + thumb (+ optional filmstrip) exist for media.
  Future<Map<String, dynamic>> ensureProxy({
    required String mediaId,
    required String mediaPath,
    bool filmstrip = true,
  }) async {
    final res = await http.post(
      _u('/proxy/ensure'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'mediaId': mediaId,
        'mediaPath': mediaPath,
        'filmstrip': filmstrip,
      }),
    ).timeout(const Duration(minutes: 5));
    if (res.statusCode >= 400) {
      throw Exception('Proxy ensure failed: ${res.statusCode} ${res.body}');
    }
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    if (data['proxyPath'] != null) {
      _proxyPathCache[mediaId] = data['proxyPath'] as String;
    }
    if (data['thumbnailPath'] != null) {
      _thumbCache[mediaId] = data['thumbnailPath'] as String;
    }
    return data;
  }

  /// Batch ensure for all project media (bounded on server).
  Future<List<dynamic>> ensureProxies(
    List<Map<String, String>> items, {
    bool filmstrip = false,
  }) async {
    final res = await http.post(
      _u('/proxy/ensure-batch'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'items': items, 'filmstrip': filmstrip}),
    ).timeout(const Duration(minutes: 15));
    if (res.statusCode >= 400) {
      throw Exception('Proxy batch failed: ${res.statusCode}');
    }
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    return (data['results'] as List?) ?? [];
  }

  /// Cheap scrub frame from proxy at timeMs.
  Future<String?> scrubFrame(String mediaId, int timeMs) async {
    final res = await http.get(
      _u('/proxy/scrub').replace(queryParameters: {
        'mediaId': mediaId,
        'timeMs': '$timeMs',
      }),
    ).timeout(const Duration(seconds: 15));
    if (res.statusCode >= 400) return null;
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    return data['path'] as String?;
  }

  String? cachedProxyPath(String mediaId) => _proxyPathCache[mediaId];
  String? cachedThumb(String mediaId) => _thumbCache[mediaId];
}
