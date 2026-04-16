import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import 'models.dart';

/// REST API-based backend service.
/// Replaces all Firebase SDK calls (firebase_auth, cloud_firestore, cloud_functions).
class BackendService {
  BackendService._();

  // ─── Configuration ──────────────────────────────────────────────────────────

  /// Base URL of the Next.js server — set this to your server's address.
  /// For Android emulator, use 10.0.2.2 to reach host machine.
  static const String _defaultBaseUrl = 'http://10.0.2.2:3000';

  static late String _baseUrl;
  static const _storage = FlutterSecureStorage();

  // Keys for secure storage
  static const _kJwtToken    = 'agent_jwt_token';
  static const _kDeviceId    = 'agent_device_id';
  static const _kAuthUid     = 'agent_auth_uid';

  // Keys for shared preferences
  static const _kBackendBaseUrl = 'agent_backend_base_url';
  static const _kDeviceName  = 'agent_device_name';
  static const _kSimProvider = 'agent_sim_provider';

  // ─── Initialize ─────────────────────────────────────────────────────────────

  static Future<void> initialize({String? baseUrl}) async {
    final prefs = await SharedPreferences.getInstance();
    final storedBaseUrl = prefs.getString(_kBackendBaseUrl);
    _baseUrl = _normalizeBaseUrl(baseUrl ?? storedBaseUrl ?? _defaultBaseUrl);
    debugPrint('[BackendService] Initialized with baseUrl: $_baseUrl');
  }

  static String get currentBaseUrl => _baseUrl;

  static Future<bool> hasStoredBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.containsKey(_kBackendBaseUrl);
  }

  static Future<String> getConfiguredBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    final storedBaseUrl = prefs.getString(_kBackendBaseUrl);
    return _normalizeBaseUrl(storedBaseUrl ?? _baseUrl);
  }

  static Future<void> saveBaseUrl(String baseUrl) async {
    final normalized = _normalizeBaseUrl(baseUrl);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kBackendBaseUrl, normalized);
    _baseUrl = normalized;
    debugPrint('[BackendService] Saved baseUrl: $_baseUrl');
  }

  static Future<void> resetBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kBackendBaseUrl);
    _baseUrl = _defaultBaseUrl;
    debugPrint('[BackendService] Reset baseUrl to default: $_baseUrl');
  }

  static Future<Map<String, dynamic>> testBaseUrl(String baseUrl) async {
    final normalized = _normalizeBaseUrl(baseUrl);
    final uri = Uri.parse('$normalized/api/agent/bootstrap');
    final response = await http.get(uri, headers: _unauthHeaders());
    return _handleResponse(response);
  }

  // ─── Auth / Device Config ───────────────────────────────────────────────────

  static Future<bool> get isAuthenticated async {
    final token = await _storage.read(key: _kJwtToken);
    return token != null && token.isNotEmpty;
  }

  static Future<AgentConfig?> loadConfig() async {
    final deviceId = await _storage.read(key: _kDeviceId);
    if (deviceId == null) return null;

    final prefs = await SharedPreferences.getInstance();
    final name = prefs.getString(_kDeviceName) ?? 'Unknown Device';
    final simProvider = prefs.getString(_kSimProvider) ?? 'SIM 1';
    return AgentConfig(deviceId: deviceId, name: name, simProvider: simProvider);
  }

  static Future<void> clearConfig() async {
    await _storage.deleteAll();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kDeviceName);
    await prefs.remove(_kSimProvider);
  }

  // ─── Device Registration ────────────────────────────────────────────────────

  /// Registers device with a one-time registration token from the admin panel.
  /// Returns the device ID once registered.
  static Future<String> registerDevice({
    required String registrationToken,
    required String deviceName,
    required String simProvider,
    String? deviceFingerprint,
    String? appVersion,
  }) async {
    final response = await _post('/api/agent/register', {
      'token': registrationToken,
      'name': deviceName,
      'simProvider': simProvider,
      if (deviceFingerprint != null) 'deviceFingerprint': deviceFingerprint,
      if (appVersion != null) 'appVersion': appVersion,
    });

    final data = response['data'] as Map<String, dynamic>;
    final deviceId = data['deviceId'] as String;
    final jwtToken = data['jwtToken'] as String;

    // Store credentials
    await _storage.write(key: _kJwtToken, value: jwtToken);
    await _storage.write(key: _kDeviceId, value: deviceId);
    await _storage.write(key: _kAuthUid, value: data['authUid'] as String? ?? '');

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kDeviceName, deviceName);
    await prefs.setString(_kSimProvider, simProvider);

    debugPrint('[BackendService] Device registered: $deviceId');
    return deviceId;
  }

  // ─── Heartbeat ──────────────────────────────────────────────────────────────

  static Future<void> sendHeartbeat({
    String? currentJob,
    String? simProvider,
    String? name,
    String? appVersion,
  }) async {
    try {
      await _authPost('/api/agent/heartbeat', {
        if (currentJob != null) 'currentJob': currentJob,
        if (simProvider != null) 'simProvider': simProvider,
        if (name != null) 'name': name,
        if (appVersion != null) 'appVersion': appVersion,
      });
    } catch (e) {
      debugPrint('[BackendService] Heartbeat failed: $e');
    }
  }

  // ─── Queue / Job Management ─────────────────────────────────────────────────

  /// Fetch the next queued job. Returns null if queue is empty.
  static Future<ExecutionJob?> fetchNextQueuedJob() async {
    final result = await _authGet('/api/agent/queue');
    final data = result['job'];
    if (data == null) return null;
    return ExecutionJob.fromMap(data as Map<String, dynamic>);
  }

  /// Fetch a specific job by ID.
  static Future<ExecutionJob?> fetchJob(String jobId) async {
    final result = await _authGet('/api/agent/queue/$jobId');
    final data = result['job'];
    if (data == null) return null;
    return ExecutionJob.fromMap(data as Map<String, dynamic>);
  }

  /// Atomically acquire a job lock. Returns true if acquired.
  static Future<bool> acquireJobLock(String jobId) async {
    final result = await _authPost('/api/agent/queue/$jobId/lock', {});
    return result['data']['acquired'] == true;
  }

  /// Report the result of a job.
  static Future<void> reportJobResult({
    required String jobId,
    required String txId,
    required String rawSms,
    required bool isSuccess,
    Map<String, dynamic>? parsedResult,
    List<Map<String, dynamic>>? ussdStepsExecuted,
  }) async {
    await _authPost('/api/agent/queue/$jobId/result', {
      'txId': txId,
      'rawSms': rawSms,
      'parsedResult': {
        'success': isSuccess,
        ...?parsedResult,
      },
      'ussdStepsExecuted': ussdStepsExecuted ?? [],
    });
  }

  // ─── Service Config ─────────────────────────────────────────────────────────

  static Future<ServiceConfig?> fetchService(String serviceId) async {
    try {
      final result = await _authGet('/api/agent/services/$serviceId');
      final data = result['service'];
      if (data == null) return null;
      return ServiceConfig.fromMap(data as Map<String, dynamic>);
    } catch (e) {
      debugPrint('[BackendService] fetchService error: $e');
      return null;
    }
  }

  // ─── Private HTTP helpers ───────────────────────────────────────────────────

  static Future<Map<String, dynamic>> _post(
    String path,
    Map<String, dynamic> body,
  ) async {
    final uri = Uri.parse('$_baseUrl$path');
    final response = await http.post(
      uri,
      headers: _unauthHeaders(),
      body: jsonEncode(body),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> _authGet(String path) async {
    final token = await _storage.read(key: _kJwtToken);
    if (token == null) throw Exception('Not authenticated');
    final uri = Uri.parse('$_baseUrl$path');
    final response = await http.get(uri, headers: _authHeaders(token));
    if (response.statusCode == 401) {
      throw Exception('UNAUTHENTICATED: JWT expired or revoked');
    }
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> _authPost(
    String path,
    Map<String, dynamic> body,
  ) async {
    final token = await _storage.read(key: _kJwtToken);
    if (token == null) throw Exception('Not authenticated');
    final uri = Uri.parse('$_baseUrl$path');
    final response = await http.post(
      uri,
      headers: _authHeaders(token),
      body: jsonEncode(body),
    );
    if (response.statusCode == 401) {
      throw Exception('UNAUTHENTICATED: JWT expired or revoked');
    }
    return _handleResponse(response);
  }

  static Map<String, String> _unauthHeaders() => {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  static Map<String, String> _authHeaders(String token) => {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': 'Bearer $token',
  };

  static String _normalizeBaseUrl(String baseUrl) {
    final trimmed = baseUrl.trim();
    if (trimmed.isEmpty) return _defaultBaseUrl;

    final parsed = Uri.tryParse(trimmed);
    if (parsed == null || !parsed.hasScheme || parsed.host.isEmpty) {
      return trimmed.replaceAll(RegExp(r'/+$'), '');
    }

    final normalizedPath = parsed.path.replaceAll(RegExp(r'/+$'), '');
    final agentPathIndex = normalizedPath.indexOf('/api/agent/');
    final basePath = agentPathIndex >= 0
        ? normalizedPath.substring(0, agentPathIndex)
        : normalizedPath;

    return parsed
        .replace(
          path: basePath,
          query: null,
          fragment: null,
        )
        .toString()
        .replaceAll(RegExp(r'/+$'), '');
  }

  static Map<String, dynamic> _handleResponse(http.Response response) {
    final body = response.body;
    Map<String, dynamic> data;
    try {
      data = jsonDecode(body) as Map<String, dynamic>;
    } catch (_) {
      data = {'raw': body};
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return {'data': data, ...data};
    }

    final error = data['error'] ?? 'HTTP ${response.statusCode}';
    throw Exception(error.toString());
  }

  // ─── Utilities ──────────────────────────────────────────────────────────────

  /// Resolves USSD flow into dial segments.
  ///
  /// Prefers [job.ussdFlow] which is already server-side resolved
  /// (all placeholders substituted with real values by the backend).
  /// Falls back to re-resolving the raw [service.ussdFlow] template
  /// only when the job field is absent.
  static List<String> resolveUssdFlow({
    required ExecutionJob job,
    required ServiceConfig service,
  }) {
    // Use the pre-resolved flow from the job when available.
    // The server already substituted {recipientNumber}, {amount}, {pin}.
    final resolvedFlow = (job.ussdFlow != null && job.ussdFlow!.trim().isNotEmpty)
        ? job.ussdFlow!
        : _resolveTemplate(service.ussdFlow, job, service);

    return resolvedFlow.split('-');
  }

  /// Fallback: manually substitute placeholders in the raw service template.
  /// Supports both {recipientNumber} and the legacy {target} alias.
  static String _resolveTemplate(
    String template,
    ExecutionJob job,
    ServiceConfig service,
  ) {
    final amountStr = job.amount.toString();
    final pin = service.pin;
    return template
        .replaceAll('{recipientNumber}', job.recipientNumber)
        .replaceAll('{target}', job.recipientNumber) // legacy alias
        .replaceAll('{amount}', amountStr)
        .replaceAll('{pin}', pin);
  }

  /// Finds a confirmation SMS using the [successSmsFormat] embedded in the job.
  /// This is the primary method — all data comes from the job object returned
  /// by the queue API, which was snapshotted from the service at transaction time.
  static SmsEntry? pickConfirmationSmsFromJob({
    required List<SmsEntry> messages,
    required ExecutionJob job,
  }) {
    return _matchSms(
      messages: messages,
      template: job.successSmsFormat ?? '',
      recipientNumber: job.recipientNumber,
    );
  }

  /// Legacy: Finds an SMS matching the service's confirmation template.
  /// Prefer [pickConfirmationSmsFromJob] when the job object is available.
  static SmsEntry? pickConfirmationSms({
    required List<SmsEntry> messages,
    required ExecutionJob job,
    required ServiceConfig service,
  }) {
    return _matchSms(
      messages: messages,
      template: service.successSmsFormat,
      recipientNumber: job.recipientNumber,
    );
  }

  /// Shared SMS matching logic. Converts a format template with
  /// {placeholders} into a regex and scans the message list.
  static SmsEntry? _matchSms({
    required List<SmsEntry> messages,
    required String template,
    required String recipientNumber,
  }) {
    if (messages.isEmpty || template.trim().isEmpty) return null;

    // Build a loose regex: replace any {placeholder} with .*?
    final patternStr = template.replaceAll(RegExp(r'\{[^}]+\}'), r'.*?');
    try {
      final regex = RegExp(patternStr, caseSensitive: false);
      for (final msg in messages) {
        if (regex.hasMatch(msg.body)) return msg;
      }
    } catch (_) {
      // Regex failed — fall back to keyword search
      for (final msg in messages) {
        if (msg.body.toLowerCase().contains('successful') ||
            msg.body.contains(recipientNumber)) {
          return msg;
        }
      }
    }
    return null;
  }
}
