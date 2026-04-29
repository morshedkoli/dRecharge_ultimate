import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import 'package:device_info_plus/device_info_plus.dart';
import 'package:battery_plus/battery_plus.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/services.dart';
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
  static const _kBackendBaseUrl  = 'agent_backend_base_url';
  static const _kDeviceName      = 'agent_device_name';
  static const _kSimProvider     = 'agent_sim_provider';
  static const _kIsPoweredOn     = 'agent_is_powered_on';
  static const _kLastDeviceInfo  = 'agent_last_device_info';

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

  static Future<String?> getStoredJwtToken() {
    return _storage.read(key: _kJwtToken);
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
    await prefs.remove(_kIsPoweredOn);
  }

  // ─── Power State ─────────────────────────────────────────────────────────────

  static Future<void> savePowerState(bool isPoweredOn) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kIsPoweredOn, isPoweredOn);
  }

  static Future<bool> loadPowerState() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_kIsPoweredOn) ?? true; // default ON
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

  static Future<bool?> sendHeartbeat({
    String? currentJob,
    String? simProvider,
    String? name,
    String? appVersion,
    bool isPoweredOn = true,
    bool powerToggle = false,
  }) async {
    try {
      // Collect battery info fresh for every heartbeat
      int? batteryLevel;
      bool? isCharging;
      try {
        final battery = Battery();
        batteryLevel = await battery.batteryLevel;
        final state = await battery.batteryState;
        isCharging = state == BatteryState.charging || state == BatteryState.full;
      } catch (_) {}

      final response = await _authPost('/api/agent/heartbeat', {
        if (currentJob != null) 'currentJob': currentJob,
        if (simProvider != null) 'simProvider': simProvider,
        if (name != null) 'name': name,
        if (appVersion != null) 'appVersion': appVersion,
        'isPoweredOn': isPoweredOn,
        'powerToggle': powerToggle,
        if (batteryLevel != null) 'batteryLevel': batteryLevel,
        if (isCharging != null) 'isCharging': isCharging,
      });
      return response['data']['isPoweredOn'] as bool?;
    } catch (e) {
      debugPrint('[BackendService] Heartbeat failed: $e');
      return null;
    }
  }

  // ─── Device Info ────────────────────────────────────────────────────────────

  /// Collects hardware/network info and sends it to the backend.
  /// Falls back silently on any error. Stores last payload locally.
  static Future<void> sendDeviceInfo() async {
    try {
      final payload = await _collectDeviceInfo();
      // Persist locally for offline inspection
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kLastDeviceInfo, jsonEncode(payload));
      // Send to backend (ignore errors — non-critical)
      await _authPost('/api/agent/device-info', payload);
      debugPrint('[BackendService] Device info sent');
    } catch (e) {
      debugPrint('[BackendService] sendDeviceInfo failed: $e');
    }
  }

  /// Returns the last device info payload stored locally, or null.
  static Future<Map<String, dynamic>?> loadLastDeviceInfo() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_kLastDeviceInfo);
    if (raw == null) return null;
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  static Future<Map<String, dynamic>> _collectDeviceInfo() async {
    // ── Device model/brand/Android version ──
    String deviceName = '', model = '', brand = '', manufacturer = '',
        androidVersion = '';
    int sdkInt = 0;
    try {
      final plugin = DeviceInfoPlugin();
      final info = await plugin.androidInfo;
      model = info.model;
      brand = info.brand;
      manufacturer = info.manufacturer;
      androidVersion = info.version.release;
      sdkInt = info.version.sdkInt;
      deviceName = '$brand $model'.trim();
    } catch (_) {}

    // ── RAM from /proc/meminfo ──
    int ramTotalMb = 0, ramAvailableMb = 0;
    try {
      final content = await File('/proc/meminfo').readAsString();
      for (final line in content.split('\n')) {
        final parts = line.trim().split(RegExp(r'\s+'));
        if (parts.length >= 2) {
          final kb = int.tryParse(parts[1]) ?? 0;
          if (line.startsWith('MemTotal:')) ramTotalMb = kb ~/ 1024;
          if (line.startsWith('MemAvailable:')) ramAvailableMb = kb ~/ 1024;
        }
      }
    } catch (_) {}

    // ── Storage via native channel (StatFs on /data partition) ──
    int storageTotalMb = 0, storageAvailableMb = 0;
    try {
      const _nativeChannel = MethodChannel('drecharge_agent/native');
      final info = await _nativeChannel.invokeMapMethod<String, dynamic>('getStorageInfo');
      storageTotalMb     = (info?['totalMb'] as num?)?.toInt() ?? 0;
      storageAvailableMb = (info?['freeMb']  as num?)?.toInt() ?? 0;
    } catch (_) {}

    // ── Battery ──
    int batteryLevel = 0;
    bool isCharging = false;
    try {
      final battery = Battery();
      batteryLevel = await battery.batteryLevel;
      final state  = await battery.batteryState;
      isCharging = state == BatteryState.charging || state == BatteryState.full;
    } catch (_) {}

    // ── Network type ──
    String networkType = 'unknown';
    try {
      final result = await Connectivity().checkConnectivity();
      if (result.contains(ConnectivityResult.wifi)) {
        networkType = 'wifi';
      } else if (result.contains(ConnectivityResult.mobile)) {
        networkType = 'mobile';
      } else if (result.contains(ConnectivityResult.none)) {
        networkType = 'none';
      } else {
        networkType = 'other';
      }
    } catch (_) {}

    // ── Local IP address ──
    String ipAddress = '';
    try {
      final interfaces = await NetworkInterface.list(
        type: InternetAddressType.IPv4,
        includeLoopback: false,
      );
      for (final iface in interfaces) {
        for (final addr in iface.addresses) {
          if (!addr.isLoopback) {
            ipAddress = addr.address;
            break;
          }
        }
        if (ipAddress.isNotEmpty) break;
      }
    } catch (_) {}

    // ── SIM carrier (use stored provider name) ──
    String simCarrier = '';
    try {
      final prefs = await SharedPreferences.getInstance();
      simCarrier = prefs.getString(_kSimProvider) ?? '';
    } catch (_) {}

    return {
      'deviceName': deviceName,
      'model': model,
      'brand': brand,
      'manufacturer': manufacturer,
      'androidVersion': androidVersion,
      'sdkInt': sdkInt,
      'ramTotalMb': ramTotalMb,
      'ramAvailableMb': ramAvailableMb,
      'storageTotalMb': storageTotalMb,
      'storageAvailableMb': storageAvailableMb,
      'batteryLevel': batteryLevel,
      'isCharging': isCharging,
      'networkType': networkType,
      'ipAddress': ipAddress,
      'simCarrier': simCarrier,
    };
  }

  // ─── Subscription ───────────────────────────────────────────────────────────

  /// Fetches subscription status from the backend's /api/subscription endpoint.
  /// Returns null on network error — caller should treat null as "unknown".
  static Future<SubscriptionInfo?> fetchSubscriptionStatus() async {
    try {
      final uri = Uri.parse('$_baseUrl/api/subscription');
      final response = await http
          .get(uri, headers: _unauthHeaders())
          .timeout(const Duration(seconds: 10));
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        return SubscriptionInfo.fromMap(data);
      }
      return null;
    } catch (e) {
      debugPrint('[BackendService] fetchSubscriptionStatus failed: $e');
      return null;
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
    required String serviceName,
    required String recipientNumber,
    required num amount,
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
      'serviceName': serviceName,
      'recipientNumber': recipientNumber,
      'amount': amount,
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

  // ─── SMS Inbox Upload ────────────────────────────────────────────────────────

  /// Uploads a batch of [SmsEntry] messages to the admin SMS inbox.
  ///
  /// Each entry is mapped to `{sender, body, receivedAt}` as expected by
  /// `POST /api/agent/sms`. Returns the number of messages saved, or -1 on
  /// error. Silent — never throws.
  static Future<int> sendSmsToInbox(List<SmsEntry> messages) async {
    if (messages.isEmpty) return 0;
    try {
      final payload = messages
          .map((m) => {
                'sender': m.address,
                'body': m.body,
                'receivedAt': m.dateMs,
              })
          .toList();
      final result = await _authPost('/api/agent/sms', {'messages': payload});
      final saved = result['saved'];
      return saved is int ? saved : (int.tryParse('$saved') ?? 0);
    } catch (e) {
      debugPrint('[BackendService] sendSmsToInbox failed: $e');
      return -1;
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

  // ─── USSD Step Resolution ───────────────────────────────────────────────────

  /// Returns the [UssdStep] list to execute for a job.
  ///
  /// The job's [ussdSteps] list — set by the server with all placeholders
  /// already resolved — is the only supported execution path.
  ///
  /// Returns an empty list when the job has no steps.
  static List<UssdStep> resolveUssdSteps({required ExecutionJob job}) {
    return job.ussdSteps ?? [];
  }

  // ─── SMS Matching ─────────────────────────────────────────────────────────

  /// Converts an admin SMS template into a tolerant regex.
  ///
  /// Literal text is escaped, whitespace is normalized, and any
  /// `{placeholder}` token matches a short dynamic segment.
  static RegExp? _templateRegex(String template) {
    final trimmed = template.trim();
    if (trimmed.isEmpty) return null;

    final placeholder = RegExp(r'\{[^}]+\}');
    final buffer = StringBuffer();
    var index = 0;
    for (final match in placeholder.allMatches(trimmed)) {
      final literal = trimmed.substring(index, match.start);
      buffer.write(RegExp.escape(literal).replaceAll(RegExp(r'\s+'), r'\s+'));
      buffer.write(r'.*?');
      index = match.end;
    }
    final tail = trimmed.substring(index);
    buffer.write(RegExp.escape(tail).replaceAll(RegExp(r'\s+'), r'\s+'));

    try {
      return RegExp(buffer.toString(), caseSensitive: false, dotAll: true);
    } catch (_) {
      return null;
    }
  }

  /// Shared SMS matching logic. Converts a format template with
  /// {placeholders} into a regex and scans the message list.
  static SmsEntry? _matchSms({
    required List<SmsEntry> messages,
    required String template,
    required String recipientNumber,
  }) {
    if (messages.isEmpty || template.trim().isEmpty) return null;

    final regex = _templateRegex(template);
    if (regex != null) {
      for (final msg in messages) {
        if (regex.hasMatch(msg.body)) return msg;
      }
    } else {
      for (final msg in messages) {
        if (msg.body.toLowerCase().contains(template.trim().toLowerCase())) {
          return msg;
        }
      }
    }
    return null;
  }

  // ─── Failure SMS Matching ─────────────────────────────────────────────────

  /// Tries each [SmsFailureTemplate] in order and returns the first match.
  ///
  /// Returns null if no failure template matches any message.
  static ({SmsEntry sms, SmsFailureTemplate template})? matchFailureSms({
    required List<SmsEntry> messages,
    required List<SmsFailureTemplate> templates,
    required String recipientNumber,
  }) {
    for (final ft in templates) {
      if (ft.template.trim().isEmpty) continue;
      final matched = _matchSms(
        messages: messages,
        template: ft.template,
        recipientNumber: recipientNumber,
      );
      if (matched != null) return (sms: matched, template: ft);
    }
    return null;
  }

  /// Convenience: checks success SMS first, then failure templates.
  ///
  /// Returns a [SmsMatchResult] with full details about what was found.
  static SmsMatchResult matchIncomingSms({
    required List<SmsEntry> messages,
    required ExecutionJob job,
  }) {
    // 1. Check success template
    final successSms = _matchSms(
      messages: messages,
      template: job.successSmsFormat ?? '',
      recipientNumber: job.recipientNumber,
    );
    if (successSms != null) {
      return SmsMatchResult(
        sms: successSms,
        isSuccess: true,
        failureReason: null,
        matched: true,
      );
    }

    // 2. Check each failure template
    final failureMatch = matchFailureSms(
      messages: messages,
      templates: job.failureSmsTemplates,
      recipientNumber: job.recipientNumber,
    );
    if (failureMatch != null) {
      return SmsMatchResult(
        sms: failureMatch.sms,
        isSuccess: false,
        failureReason: failureMatch.template.message,
        matched: true,
      );
    }

    return SmsMatchResult(
      sms: messages.isNotEmpty ? messages.first : null,
      isSuccess: false,
      failureReason: messages.isNotEmpty
          ? 'SMS received but did not match any success or failure template.'
          : null,
      matched: false,
    );
  }
}

/// Result of matching an incoming SMS against success and failure templates.
class SmsMatchResult {
  const SmsMatchResult({
    required this.sms,
    required this.isSuccess,
    required this.failureReason,
    this.matched = false,
  });

  /// The matched SMS, or null if no template matched.
  final SmsEntry? sms;

  /// True when the SMS matched the success template.
  final bool isSuccess;

  /// Admin-configured failure reason when a failure template matched.
  /// Null when no failure template matched or when [isSuccess] is true.
  final String? failureReason;

  /// True only when the SMS matched a configured success or failure template.
  final bool matched;

  /// Returns true if any template matched (success or failure).
  bool get hasMatch => matched;
}
