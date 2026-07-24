import 'dart:convert';
import 'package:http/http.dart' as http;
import 'token_storage.dart';

class ApiException implements Exception {
  final String message;
  final int status;
  ApiException(this.message, this.status);

  @override
  String toString() => message;
}

/// Wraps the NCMS backend REST API used by the web app (see frontend/src/lib/api.ts),
/// with tokens kept in platform-secure storage and transparently refreshed on a 401.
class ApiClient {
  final String baseUrl;
  final http.Client _httpClient;
  final TokenStorage _storage;
  static const _accessKey = 'ncms_access_token';
  static const _refreshKey = 'ncms_refresh_token';

  ApiClient({required this.baseUrl, http.Client? httpClient, TokenStorage? storage})
      : _httpClient = httpClient ?? http.Client(),
        _storage = storage ?? SecureTokenStorage();

  Future<String?> get accessToken => _storage.read(_accessKey);
  Future<String?> get refreshToken => _storage.read(_refreshKey);

  Future<void> storeTokens({required String accessToken, required String refreshToken}) async {
    await _storage.write(_accessKey, accessToken);
    await _storage.write(_refreshKey, refreshToken);
  }

  Future<void> clearTokens() async {
    await _storage.delete(_accessKey);
    await _storage.delete(_refreshKey);
  }

  Future<bool> tryRefresh() async {
    final refresh = await refreshToken;
    if (refresh == null) return false;
    final res = await _httpClient.post(
      Uri.parse('$baseUrl/auth/refresh'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'refreshToken': refresh}),
    );
    if (res.statusCode != 200 && res.statusCode != 201) return false;
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    await storeTokens(accessToken: body['accessToken'] as String, refreshToken: body['refreshToken'] as String);
    return true;
  }

  Future<dynamic> _decode(http.Response res) {
    if (res.body.isEmpty) return Future.value(null);
    return Future.value(jsonDecode(res.body));
  }

  Future<T> request<T>(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
    bool auth = true,
    required T Function(dynamic json) parse,
  }) async {
    Future<http.Response> send(String? token) {
      final headers = {'Content-Type': 'application/json'};
      if (auth && token != null) headers['Authorization'] = 'Bearer $token';
      final uri = Uri.parse('$baseUrl$path');
      final encodedBody = body != null ? jsonEncode(body) : null;
      switch (method) {
        case 'POST':
          return _httpClient.post(uri, headers: headers, body: encodedBody);
        case 'PATCH':
          return _httpClient.patch(uri, headers: headers, body: encodedBody);
        case 'DELETE':
          return _httpClient.delete(uri, headers: headers);
        default:
          return _httpClient.get(uri, headers: headers);
      }
    }

    var token = auth ? await accessToken : null;
    var res = await send(token);

    if (auth && res.statusCode == 401) {
      final refreshed = await tryRefresh();
      if (refreshed) {
        token = await accessToken;
        res = await send(token);
      }
    }

    final json = await _decode(res);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      final message = json is Map<String, dynamic> ? json['message'] : null;
      final text = message is List ? message.join(', ') : (message?.toString() ?? 'Request failed');
      throw ApiException(text, res.statusCode);
    }
    return parse(json);
  }
}
