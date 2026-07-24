import 'package:flutter/foundation.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../api/ncms_api.dart';

const governanceRoles = {
  'COOPERATIVE_ADMIN',
  'CHAIRMAN',
  'SECRETARY',
  'TREASURER',
  'AUDITOR',
  'LOAN_OFFICER',
};

class Session extends ChangeNotifier {
  final ApiClient client;
  late final NcmsApi api;

  Session(this.client) {
    api = NcmsApi(client);
  }

  AuthUser? currentUser;
  Cooperative? activeCooperative;
  String? myRoleInCooperative;
  bool restoring = true;

  bool get isGovernance => myRoleInCooperative != null && governanceRoles.contains(myRoleInCooperative);

  Future<bool> restoreSession() async {
    final token = await client.accessToken;
    if (token == null) {
      restoring = false;
      notifyListeners();
      return false;
    }
    try {
      currentUser = await api.me();
      restoring = false;
      notifyListeners();
      return true;
    } catch (_) {
      await client.clearTokens();
      restoring = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> login(String email, String password, {String? mfaCode}) async {
    final result = await api.login(email, password, mfaCode: mfaCode);
    await client.storeTokens(
      accessToken: result['accessToken'] as String,
      refreshToken: result['refreshToken'] as String,
    );
    currentUser = AuthUser.fromJson(result['user'] as Map<String, dynamic>);
    notifyListeners();
  }

  Future<void> register(String email, String password, String firstName, String lastName) async {
    final result = await api.register(email, password, firstName, lastName);
    await client.storeTokens(
      accessToken: result['accessToken'] as String,
      refreshToken: result['refreshToken'] as String,
    );
    currentUser = AuthUser.fromJson(result['user'] as Map<String, dynamic>);
    notifyListeners();
  }

  Future<void> logout() async {
    final refresh = await client.refreshToken;
    if (refresh != null) {
      try {
        await api.logout(refresh);
      } catch (_) {
        // Best-effort server-side revoke; proceed with local logout regardless.
      }
    }
    await client.clearTokens();
    currentUser = null;
    activeCooperative = null;
    myRoleInCooperative = null;
    notifyListeners();
  }

  Future<void> selectCooperative(Cooperative cooperative) async {
    activeCooperative = cooperative;
    myRoleInCooperative = null;
    notifyListeners();
    try {
      final members = await api.listMembers(cooperative.id);
      final mine = members.where((m) => m['userId'] == currentUser?.id);
      if (mine.isNotEmpty) {
        myRoleInCooperative = mine.first['role'] as String?;
      }
    } catch (_) {
      // Non-governance members may not be able to list all members; that's fine --
      // it just means we treat them as a plain member for UI purposes.
    }
    notifyListeners();
  }

  void clearCooperative() {
    activeCooperative = null;
    myRoleInCooperative = null;
    notifyListeners();
  }
}
