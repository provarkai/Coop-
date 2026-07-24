import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../state/session.dart';
import '../widgets/common.dart';

class LoanProductsScreen extends StatefulWidget {
  const LoanProductsScreen({super.key});

  @override
  State<LoanProductsScreen> createState() => _LoanProductsScreenState();
}

class _LoanProductsScreenState extends State<LoanProductsScreen> {
  late Future<List<LoanProduct>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<LoanProduct>> _load() {
    final session = context.read<Session>();
    return session.api.listLoanProducts(session.activeCooperative!.id);
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Loan products')),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<List<LoanProduct>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return ErrorBanner(
                message: 'Could not load loan products: ${snapshot.error}',
              );
            }
            final products = snapshot.data ?? [];
            if (products.isEmpty) {
              return ListView(
                children: const [
                  Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('No loan products yet.'),
                  ),
                ],
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: products.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final p = products[i];
                return Card(
                  child: ListTile(
                    key: Key('loan-product-${p.code}'),
                    leading: const Icon(Icons.request_quote),
                    title: Text(p.name),
                    subtitle: Text(
                      '${p.code} · max ${formatNaira(p.maxAmount)} · up to ${p.maxTermMonths} months',
                    ),
                  ),
                );
              },
            );
          },
        ),
      ),
      floatingActionButton: FloatingActionButton(
        key: const Key('create-loan-product-fab'),
        tooltip: 'New loan product',
        onPressed: () async {
          final created = await Navigator.of(context).push<bool>(
            MaterialPageRoute(builder: (_) => const CreateLoanProductScreen()),
          );
          if (created == true) _refresh();
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}

class CreateLoanProductScreen extends StatefulWidget {
  const CreateLoanProductScreen({super.key});

  @override
  State<CreateLoanProductScreen> createState() =>
      _CreateLoanProductScreenState();
}

class _CreateLoanProductScreenState extends State<CreateLoanProductScreen> {
  final _nameController = TextEditingController();
  final _codeController = TextEditingController();
  final _rateController = TextEditingController(text: '0');
  final _maxAmountController = TextEditingController();
  final _maxTermController = TextEditingController(text: '12');
  final _penaltyRateController = TextEditingController(text: '0');
  final _guarantorsController = TextEditingController(text: '0');
  bool _loading = false;
  String? _error;

  Future<void> _submit() async {
    if (_nameController.text.trim().isEmpty ||
        _codeController.text.trim().isEmpty) {
      setState(() => _error = 'Name and code are required.');
      return;
    }
    final rate = double.tryParse(_rateController.text);
    final maxAmount = double.tryParse(_maxAmountController.text);
    final maxTerm = int.tryParse(_maxTermController.text);
    final penaltyRate = double.tryParse(_penaltyRateController.text);
    final guarantors = int.tryParse(_guarantorsController.text);
    if (rate == null ||
        maxAmount == null ||
        maxTerm == null ||
        penaltyRate == null ||
        guarantors == null) {
      setState(() => _error = 'Enter valid numbers for all numeric fields.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    final session = context.read<Session>();
    try {
      await session.api.createLoanProduct(
        session.activeCooperative!.id,
        name: _nameController.text.trim(),
        code: _codeController.text.trim(),
        interestRatePercent: rate,
        maxAmount: maxAmount,
        maxTermMonths: maxTerm,
        penaltyRatePercent: penaltyRate,
        requiredGuarantors: guarantors,
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
      appBar: AppBar(title: const Text('New loan product')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              key: const Key('loan-product-name-field'),
              controller: _nameController,
              decoration: const InputDecoration(
                labelText: 'Name',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              key: const Key('loan-product-code-field'),
              controller: _codeController,
              decoration: const InputDecoration(
                labelText: 'Code',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _rateController,
              decoration: const InputDecoration(
                labelText: 'Interest rate (%)',
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _maxAmountController,
              decoration: const InputDecoration(
                labelText: 'Max amount (₦)',
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _maxTermController,
              decoration: const InputDecoration(
                labelText: 'Max term (months)',
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _penaltyRateController,
              decoration: const InputDecoration(
                labelText: 'Penalty rate (%)',
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _guarantorsController,
              decoration: const InputDecoration(
                labelText: 'Required guarantors',
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
              key: const Key('create-loan-product-submit'),
              onPressed: _loading ? null : _submit,
              child: _loading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Create product'),
            ),
          ],
        ),
      ),
    );
  }
}
