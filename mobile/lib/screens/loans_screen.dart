import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../state/session.dart';
import '../widgets/common.dart';
import 'loan_products_screen.dart';

class LoansScreen extends StatefulWidget {
  const LoansScreen({super.key});

  @override
  State<LoansScreen> createState() => _LoansScreenState();
}

class _LoansScreenState extends State<LoansScreen> {
  late Future<List<Loan>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Loan>> _load() {
    final session = context.read<Session>();
    final coopId = session.activeCooperative!.id;
    if (session.isGovernance) {
      return session.api.listLoansForCooperative(coopId);
    }
    return session.api.listLoansForMember(coopId, session.currentUser!.id);
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  Future<void> _act(Future<Loan> Function() action) async {
    try {
      await action();
      await _refresh();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'ACTIVE':
        return Colors.blue;
      case 'COMPLETED':
        return Colors.green;
      case 'REJECTED':
      case 'DEFAULTED':
        return Colors.red;
      default:
        return Colors.orange;
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    return Scaffold(
      appBar: session.isGovernance
          ? AppBar(
              title: const Text('Loans'),
              actions: [
                IconButton(
                  key: const Key('manage-loan-products-button'),
                  icon: const Icon(Icons.tune),
                  tooltip: 'Manage loan products',
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const LoanProductsScreen(),
                    ),
                  ),
                ),
              ],
            )
          : null,
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<List<Loan>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return ErrorBanner(
                message: 'Could not load loans: ${snapshot.error}',
              );
            }
            final loans = snapshot.data ?? [];
            if (loans.isEmpty) {
              return ListView(
                children: const [
                  Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('No loans yet.'),
                  ),
                ],
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: loans.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final loan = loans[i];
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              formatNaira(loan.principal),
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            Chip(
                              label: Text(loan.status),
                              backgroundColor: _statusColor(
                                loan.status,
                              ).withValues(alpha: 0.15),
                              labelStyle: TextStyle(
                                color: _statusColor(loan.status),
                              ),
                            ),
                          ],
                        ),
                        if (loan.memberName != null) Text(loan.memberName!),
                        Text(
                          '${loan.termMonths} months · outstanding ${formatNaira(loan.outstandingBalance)}',
                        ),
                        Text(
                          loan.disbursedAt != null
                              ? 'Disbursed ${formatUtcIsoAsWat(loan.disbursedAt)}'
                              : 'Applied ${formatUtcIsoAsWat(loan.createdAt)}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        if (loan.rejectionReason != null)
                          Text(
                            'Rejected: ${loan.rejectionReason}',
                            style: const TextStyle(color: Colors.red),
                          ),
                        if (session.isGovernance && loan.status == 'PENDING')
                          Row(
                            children: [
                              TextButton(
                                onPressed: () => _act(
                                  () => session.api.approveLoan(
                                    session.activeCooperative!.id,
                                    loan.id,
                                  ),
                                ),
                                child: const Text('Approve'),
                              ),
                              TextButton(
                                onPressed: () => _act(
                                  () => session.api.rejectLoan(
                                    session.activeCooperative!.id,
                                    loan.id,
                                  ),
                                ),
                                child: const Text('Reject'),
                              ),
                            ],
                          ),
                        if (session.isGovernance && loan.status == 'APPROVED')
                          TextButton(
                            onPressed: () => _act(
                              () => session.api.disburseLoan(
                                session.activeCooperative!.id,
                                loan.id,
                              ),
                            ),
                            child: const Text('Disburse'),
                          ),
                      ],
                    ),
                  ),
                );
              },
            );
          },
        ),
      ),
      floatingActionButton: session.isGovernance
          ? null
          : FloatingActionButton(
              key: const Key('apply-loan-fab'),
              tooltip: 'Apply for a loan',
              onPressed: () async {
                final applied = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(builder: (_) => const ApplyLoanScreen()),
                );
                if (applied == true) _refresh();
              },
              child: const Icon(Icons.add),
            ),
    );
  }
}

class ApplyLoanScreen extends StatefulWidget {
  const ApplyLoanScreen({super.key});

  @override
  State<ApplyLoanScreen> createState() => _ApplyLoanScreenState();
}

class _ApplyLoanScreenState extends State<ApplyLoanScreen> {
  late Future<List<LoanProduct>> _productsFuture;
  LoanProduct? _selected;
  final _amountController = TextEditingController();
  final _termController = TextEditingController(text: '6');
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _productsFuture = context.read<Session>().api.listLoanProducts(
      context.read<Session>().activeCooperative!.id,
    );
  }

  Future<void> _submit() async {
    if (_selected == null) {
      setState(() => _error = 'Choose a loan product first.');
      return;
    }
    final principal = double.tryParse(_amountController.text);
    final term = int.tryParse(_termController.text);
    if (principal == null || term == null) {
      setState(() => _error = 'Enter a valid amount and term.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    final session = context.read<Session>();
    try {
      await session.api.applyForLoan(
        session.activeCooperative!.id,
        _selected!.id,
        principal,
        term,
      );
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Apply for a loan')),
      body: FutureBuilder<List<LoanProduct>>(
        future: _productsFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          final products = snapshot.data ?? [];
          return Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                DropdownButtonFormField<LoanProduct>(
                  initialValue: _selected,
                  decoration: const InputDecoration(
                    labelText: 'Loan product',
                    border: OutlineInputBorder(),
                  ),
                  items: products
                      .map(
                        (p) => DropdownMenuItem(
                          value: p,
                          child: Text(
                            '${p.name} (max ${formatNaira(p.maxAmount)})',
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: (v) => setState(() => _selected = v),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _amountController,
                  decoration: const InputDecoration(
                    labelText: 'Amount requested (₦)',
                    border: OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _termController,
                  decoration: const InputDecoration(
                    labelText: 'Term (months)',
                    border: OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.number,
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: const TextStyle(color: Colors.red)),
                ],
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: _loading ? null : _submit,
                  child: _loading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Submit application'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
