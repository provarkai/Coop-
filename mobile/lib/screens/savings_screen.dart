import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/models.dart';
import '../state/session.dart';
import '../widgets/common.dart';

class SavingsScreen extends StatefulWidget {
  const SavingsScreen({super.key});

  @override
  State<SavingsScreen> createState() => _SavingsScreenState();
}

class _SavingsScreenState extends State<SavingsScreen> {
  late Future<List<SavingsAccount>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<SavingsAccount>> _load() {
    final session = context.read<Session>();
    final coopId = session.activeCooperative!.id;
    if (session.isGovernance) {
      return session.api.listSavingsAccountsForCooperative(coopId);
    }
    return session.api.listSavingsAccountsForMember(coopId, session.currentUser!.id);
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _refresh,
      child: FutureBuilder<List<SavingsAccount>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return ErrorBanner(message: 'Could not load savings accounts: ${snapshot.error}');
          }
          final accounts = snapshot.data ?? [];
          if (accounts.isEmpty) {
            return ListView(
              children: const [
                Padding(
                  padding: EdgeInsets.all(24),
                  child: Text('No savings accounts yet.'),
                ),
              ],
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: accounts.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, i) {
              final account = accounts[i];
              return Card(
                child: ListTile(
                  key: Key('savings-account-${account.accountNumber}'),
                  leading: const Icon(Icons.savings),
                  title: Text(account.productName ?? account.accountNumber),
                  subtitle: Text('${account.accountNumber} · ${account.status}'),
                  trailing: Text(
                    formatNaira(account.balance),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => SavingsAccountDetailScreen(account: account)),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class SavingsAccountDetailScreen extends StatefulWidget {
  final SavingsAccount account;
  const SavingsAccountDetailScreen({super.key, required this.account});

  @override
  State<SavingsAccountDetailScreen> createState() => _SavingsAccountDetailScreenState();
}

class _SavingsAccountDetailScreenState extends State<SavingsAccountDetailScreen> {
  late Future<List<SavingsTransaction>> _future;

  @override
  void initState() {
    super.initState();
    final session = context.read<Session>();
    _future = session.api.listSavingsTransactions(session.activeCooperative!.id, widget.account.id);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.account.accountNumber)),
      body: FutureBuilder<List<SavingsTransaction>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return ErrorBanner(message: 'Could not load transactions: ${snapshot.error}');
          }
          final txns = snapshot.data ?? [];
          if (txns.isEmpty) {
            return const Center(child: Text('No transactions yet.'));
          }
          return ListView.separated(
            itemCount: txns.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, i) {
              final t = txns[i];
              final isCredit = t.type != 'WITHDRAWAL';
              return ListTile(
                leading: Icon(isCredit ? Icons.arrow_downward : Icons.arrow_upward, color: isCredit ? Colors.green : Colors.red),
                title: Text(t.type),
                subtitle: Text(t.narration ?? t.createdAt),
                trailing: Text(
                  '${isCredit ? '+' : '-'}${formatNaira(t.amount)}',
                  style: TextStyle(color: isCredit ? Colors.green : Colors.red, fontWeight: FontWeight.bold),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
