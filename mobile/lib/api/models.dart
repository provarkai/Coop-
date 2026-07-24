class AuthUser {
  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final String role;

  AuthUser({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.role,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
        id: json['id'] as String,
        email: json['email'] as String,
        firstName: json['firstName'] as String,
        lastName: json['lastName'] as String,
        role: json['role'] as String,
      );
}

class Cooperative {
  final String id;
  final String name;
  final String slug;
  final String currency;

  Cooperative({
    required this.id,
    required this.name,
    required this.slug,
    required this.currency,
  });

  factory Cooperative.fromJson(Map<String, dynamic> json) => Cooperative(
        id: json['id'] as String,
        name: json['name'] as String,
        slug: json['slug'] as String,
        currency: json['currency'] as String? ?? 'NGN',
      );
}

class DashboardSummary {
  final int activeMembers;
  final int pendingApplications;
  final String totalSavingsBalance;
  final String totalOutstandingLoans;
  final int upcomingMeetings;
  final int openResolutions;
  final String cashBalance;
  final String netSurplus;

  DashboardSummary({
    required this.activeMembers,
    required this.pendingApplications,
    required this.totalSavingsBalance,
    required this.totalOutstandingLoans,
    required this.upcomingMeetings,
    required this.openResolutions,
    required this.cashBalance,
    required this.netSurplus,
  });

  factory DashboardSummary.fromJson(Map<String, dynamic> json) => DashboardSummary(
        activeMembers: json['activeMembers'] as int,
        pendingApplications: json['pendingApplications'] as int,
        totalSavingsBalance: json['totalSavingsBalance'] as String,
        totalOutstandingLoans: json['totalOutstandingLoans'] as String,
        upcomingMeetings: json['upcomingMeetings'] as int,
        openResolutions: json['openResolutions'] as int,
        cashBalance: json['cashBalance'] as String,
        netSurplus: json['netSurplus'] as String,
      );
}

class SavingsAccount {
  final String id;
  final String accountNumber;
  final String balance;
  final String status;
  final String? productName;

  SavingsAccount({
    required this.id,
    required this.accountNumber,
    required this.balance,
    required this.status,
    this.productName,
  });

  factory SavingsAccount.fromJson(Map<String, dynamic> json) => SavingsAccount(
        id: json['id'] as String,
        accountNumber: json['accountNumber'] as String,
        balance: json['balance'] as String,
        status: json['status'] as String,
        productName: (json['product'] as Map<String, dynamic>?)?['name'] as String?,
      );
}

class SavingsProduct {
  final String id;
  final String name;
  final String code;
  final String interestRatePercent;
  final String minimumBalance;
  final bool isActive;

  SavingsProduct({
    required this.id,
    required this.name,
    required this.code,
    required this.interestRatePercent,
    required this.minimumBalance,
    required this.isActive,
  });

  factory SavingsProduct.fromJson(Map<String, dynamic> json) => SavingsProduct(
        id: json['id'] as String,
        name: json['name'] as String,
        code: json['code'] as String,
        interestRatePercent: json['interestRatePercent'] as String,
        minimumBalance: json['minimumBalance'] as String,
        isActive: json['isActive'] as bool,
      );
}

class SavingsTransaction {
  final String id;
  final String type;
  final String amount;
  final String balanceAfter;
  final String? narration;
  final String createdAt;

  SavingsTransaction({
    required this.id,
    required this.type,
    required this.amount,
    required this.balanceAfter,
    this.narration,
    required this.createdAt,
  });

  factory SavingsTransaction.fromJson(Map<String, dynamic> json) => SavingsTransaction(
        id: json['id'] as String,
        type: json['type'] as String,
        amount: json['amount'] as String,
        balanceAfter: json['balanceAfter'] as String,
        narration: json['narration'] as String?,
        createdAt: json['createdAt'] as String,
      );
}

class LoanProduct {
  final String id;
  final String name;
  final String code;
  final String maxAmount;
  final int maxTermMonths;

  LoanProduct({
    required this.id,
    required this.name,
    required this.code,
    required this.maxAmount,
    required this.maxTermMonths,
  });

  factory LoanProduct.fromJson(Map<String, dynamic> json) => LoanProduct(
        id: json['id'] as String,
        name: json['name'] as String,
        code: json['code'] as String,
        maxAmount: json['maxAmount'] as String,
        maxTermMonths: json['maxTermMonths'] as int,
      );
}

class Loan {
  final String id;
  final String principal;
  final int termMonths;
  final String status;
  final String outstandingBalance;
  final String? rejectionReason;
  final String? memberName;

  Loan({
    required this.id,
    required this.principal,
    required this.termMonths,
    required this.status,
    required this.outstandingBalance,
    this.rejectionReason,
    this.memberName,
  });

  factory Loan.fromJson(Map<String, dynamic> json) {
    final membership = json['membership'] as Map<String, dynamic>?;
    final user = membership?['user'] as Map<String, dynamic>?;
    return Loan(
      id: json['id'] as String,
      principal: json['principal'] as String,
      termMonths: json['termMonths'] as int,
      status: json['status'] as String,
      outstandingBalance: json['outstandingBalance'] as String,
      rejectionReason: json['rejectionReason'] as String?,
      memberName: user != null ? '${user['firstName']} ${user['lastName']}' : null,
    );
  }
}

class Meeting {
  final String id;
  final String title;
  final String type;
  final String scheduledAt;
  final String status;
  final String? location;

  Meeting({
    required this.id,
    required this.title,
    required this.type,
    required this.scheduledAt,
    required this.status,
    this.location,
  });

  factory Meeting.fromJson(Map<String, dynamic> json) => Meeting(
        id: json['id'] as String,
        title: json['title'] as String,
        type: json['type'] as String,
        scheduledAt: json['scheduledAt'] as String,
        status: json['status'] as String,
        location: json['location'] as String?,
      );
}

class AppNotification {
  final String id;
  final String channel;
  final String? subject;
  final String body;
  final String status;
  final String createdAt;

  AppNotification({
    required this.id,
    required this.channel,
    this.subject,
    required this.body,
    required this.status,
    required this.createdAt,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) => AppNotification(
        id: json['id'] as String,
        channel: json['channel'] as String,
        subject: json['subject'] as String?,
        body: json['body'] as String,
        status: json['status'] as String,
        createdAt: json['createdAt'] as String,
      );
}
