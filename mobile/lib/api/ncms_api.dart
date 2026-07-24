import 'api_client.dart';
import 'models.dart';

/// Typed methods over [ApiClient], mirroring the subset of frontend/src/lib/api.ts
/// that the mobile app needs.
class NcmsApi {
  final ApiClient client;
  NcmsApi(this.client);

  Future<Map<String, dynamic>> login(String email, String password, {String? mfaCode}) => client.request(
        '/auth/login',
        method: 'POST',
        auth: false,
        body: {'email': email, 'password': password, if (mfaCode != null) 'mfaCode': mfaCode},
        parse: (j) => j as Map<String, dynamic>,
      );

  Future<Map<String, dynamic>> register(String email, String password, String firstName, String lastName) =>
      client.request(
        '/auth/register',
        method: 'POST',
        auth: false,
        body: {'email': email, 'password': password, 'firstName': firstName, 'lastName': lastName},
        parse: (j) => j as Map<String, dynamic>,
      );

  Future<AuthUser> me() => client.request('/auth/me', parse: (j) => AuthUser.fromJson(j as Map<String, dynamic>));

  Future<void> logout(String refreshToken) => client.request(
        '/auth/logout',
        method: 'POST',
        body: {'refreshToken': refreshToken},
        parse: (_) {},
      );

  Future<List<Cooperative>> listCooperatives() => client.request(
        '/cooperatives',
        parse: (j) => (j as List).map((e) => Cooperative.fromJson(e as Map<String, dynamic>)).toList(),
      );

  Future<DashboardSummary> getDashboard(String cooperativeId) => client.request(
        '/cooperatives/$cooperativeId/dashboard',
        parse: (j) => DashboardSummary.fromJson(j as Map<String, dynamic>),
      );

  Future<List<SavingsAccount>> listSavingsAccountsForMember(String cooperativeId, String userId) => client.request(
        '/cooperatives/$cooperativeId/members/$userId/savings/accounts',
        parse: (j) => (j as List).map((e) => SavingsAccount.fromJson(e as Map<String, dynamic>)).toList(),
      );

  Future<List<SavingsAccount>> listSavingsAccountsForCooperative(String cooperativeId) => client.request(
        '/cooperatives/$cooperativeId/savings/accounts',
        parse: (j) => (j as List).map((e) => SavingsAccount.fromJson(e as Map<String, dynamic>)).toList(),
      );

  Future<List<SavingsTransaction>> listSavingsTransactions(String cooperativeId, String accountId) => client.request(
        '/cooperatives/$cooperativeId/savings/accounts/$accountId/transactions',
        parse: (j) => (j as List).map((e) => SavingsTransaction.fromJson(e as Map<String, dynamic>)).toList(),
      );

  Future<List<LoanProduct>> listLoanProducts(String cooperativeId) => client.request(
        '/cooperatives/$cooperativeId/loan-products',
        parse: (j) => (j as List).map((e) => LoanProduct.fromJson(e as Map<String, dynamic>)).toList(),
      );

  Future<List<Loan>> listLoansForMember(String cooperativeId, String userId) => client.request(
        '/cooperatives/$cooperativeId/members/$userId/loans',
        parse: (j) => (j as List).map((e) => Loan.fromJson(e as Map<String, dynamic>)).toList(),
      );

  Future<List<Loan>> listLoansForCooperative(String cooperativeId) => client.request(
        '/cooperatives/$cooperativeId/loans',
        parse: (j) => (j as List).map((e) => Loan.fromJson(e as Map<String, dynamic>)).toList(),
      );

  Future<Loan> applyForLoan(String cooperativeId, String productId, double principal, int termMonths) =>
      client.request(
        '/cooperatives/$cooperativeId/loans',
        method: 'POST',
        body: {'productId': productId, 'principal': principal, 'termMonths': termMonths},
        parse: (j) => Loan.fromJson(j as Map<String, dynamic>),
      );

  Future<Loan> approveLoan(String cooperativeId, String loanId) => client.request(
        '/cooperatives/$cooperativeId/loans/$loanId/approve',
        method: 'POST',
        parse: (j) => Loan.fromJson(j as Map<String, dynamic>),
      );

  Future<Loan> rejectLoan(String cooperativeId, String loanId) => client.request(
        '/cooperatives/$cooperativeId/loans/$loanId/reject',
        method: 'POST',
        body: {},
        parse: (j) => Loan.fromJson(j as Map<String, dynamic>),
      );

  Future<Loan> disburseLoan(String cooperativeId, String loanId) => client.request(
        '/cooperatives/$cooperativeId/loans/$loanId/disburse',
        method: 'POST',
        parse: (j) => Loan.fromJson(j as Map<String, dynamic>),
      );

  Future<List<Meeting>> listMeetings(String cooperativeId) => client.request(
        '/cooperatives/$cooperativeId/meetings',
        parse: (j) => (j as List).map((e) => Meeting.fromJson(e as Map<String, dynamic>)).toList(),
      );

  Future<void> rsvpToMeeting(String cooperativeId, String meetingId, String status) => client.request(
        '/cooperatives/$cooperativeId/meetings/$meetingId/rsvp',
        method: 'POST',
        body: {'status': status},
        parse: (_) {},
      );

  /// Simulated multi-channel notification log (email/SMS/WhatsApp/push) -- see Sprint 9.
  /// Nothing is actually sent to a device; this reads/writes the same logged record the
  /// web app's Documents & Comms section shows.
  Future<List<AppNotification>> listMyNotifications(String cooperativeId) => client.request(
        '/cooperatives/$cooperativeId/notifications',
        parse: (j) => (j as List).map((e) => AppNotification.fromJson(e as Map<String, dynamic>)).toList(),
      );

  Future<List<AppNotification>> listAllNotifications(String cooperativeId) => client.request(
        '/cooperatives/$cooperativeId/notifications/all',
        parse: (j) => (j as List).map((e) => AppNotification.fromJson(e as Map<String, dynamic>)).toList(),
      );

  Future<List<AppNotification>> sendAnnouncement(String cooperativeId, String channel, String body, {String? subject}) =>
      client.request(
        '/cooperatives/$cooperativeId/notifications/announcements',
        method: 'POST',
        body: {'channel': channel, 'body': body, if (subject != null) 'subject': subject},
        parse: (j) => (j as List).map((e) => AppNotification.fromJson(e as Map<String, dynamic>)).toList(),
      );

  Future<List<Map<String, dynamic>>> listMembers(String cooperativeId) => client.request(
        '/cooperatives/$cooperativeId/members',
        parse: (j) => (j as List).cast<Map<String, dynamic>>(),
      );

  Future<void> approveMembership(String cooperativeId, String userId) => client.request(
        '/cooperatives/$cooperativeId/members/$userId/approve',
        method: 'POST',
        parse: (_) {},
      );

  Future<void> rejectMembership(String cooperativeId, String userId) => client.request(
        '/cooperatives/$cooperativeId/members/$userId/reject',
        method: 'POST',
        parse: (_) {},
      );
}
