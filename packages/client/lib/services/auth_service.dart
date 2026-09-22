import 'dart:convert';
import 'package:http/http.dart' as http;

/// Auth + entitlements against the unified gateway (:8788).
/// Full FastAPI auth is available via /api/v1/auth when backend is up.
class AuthService {
  final String baseUrl;
  String? token;
  Map<String, dynamic>? user;
  Map<String, dynamic>? entitlements;

  AuthService({this.baseUrl = 'http://127.0.0.1:8788'});

  Future<bool> login({String email = 'creator@phenova.local', String? name, String password = ''}) async {
    try {
      // Prefer FastAPI if reachable
      final apiRes = await http
          .post(
            Uri.parse('$baseUrl/api/v1/auth/login'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'email': email, 'password': password.isEmpty ? 'phenova' : password}),
          )
          .timeout(const Duration(seconds: 4));
      if (apiRes.statusCode < 400) {
        final data = jsonDecode(apiRes.body) as Map<String, dynamic>;
        token = data['token'] as String? ?? data['access_token'] as String?;
        user = (data['user'] as Map<String, dynamic>?) ?? {'email': email, 'name': name ?? email};
        await refreshEntitlements();
        return token != null;
      }
    } catch (_) {}

    // Engine lightweight auth
    try {
      final res = await http
          .post(
            Uri.parse('$baseUrl/auth/login'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'email': email, 'name': name}),
          )
          .timeout(const Duration(seconds: 4));
      if (res.statusCode >= 400) return false;
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      token = data['token'] as String?;
      user = data['user'] as Map<String, dynamic>?;
      await refreshEntitlements();
      return token != null;
    } catch (_) {
      return false;
    }
  }

  Future<void> refreshEntitlements() async {
    try {
      final headers = <String, String>{};
      if (token != null) headers['Authorization'] = 'Bearer $token';
      final res = await http.get(Uri.parse('$baseUrl/entitlements'), headers: headers).timeout(const Duration(seconds: 3));
      if (res.statusCode < 400) {
        entitlements = jsonDecode(res.body) as Map<String, dynamic>;
        return;
      }
    } catch (_) {}
    try {
      final headers = <String, String>{};
      if (token != null) headers['Authorization'] = 'Bearer $token';
      final res = await http
          .get(Uri.parse('$baseUrl/api/v1/premium/entitlements'), headers: headers)
          .timeout(const Duration(seconds: 3));
      if (res.statusCode < 400) {
        entitlements = jsonDecode(res.body) as Map<String, dynamic>;
      }
    } catch (_) {}
  }

  Future<void> logout() async {
    try {
      await http.post(Uri.parse('$baseUrl/auth/logout')).timeout(const Duration(seconds: 2));
    } catch (_) {}
    token = null;
    user = null;
    entitlements = null;
  }

  bool get isLoggedIn => token != null;
  bool get isPro =>
      (entitlements?['plan']?.toString().toLowerCase() == 'pro') ||
      (user?['plan']?.toString().toLowerCase() == 'pro');
}

/// Global simple holder so screens can share session without full DI.
class AuthScope {
  static final AuthService instance = AuthService();
}
