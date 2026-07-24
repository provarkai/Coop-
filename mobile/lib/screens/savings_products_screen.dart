import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../state/session.dart';
import '../widgets/common.dart';

class SavingsProductsScreen extends StatefulWidget {
  const SavingsProductsScreen({super.key});

  @override
  State<SavingsProductsScreen> createState() => _SavingsProductsScreenState();
}

class _SavingsProductsScreenState extends State<SavingsProductsScreen> {
  late Future<List<SavingsProduct>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<SavingsProduct>> _load() {
    final session = context.read<Session>();
    return session.api.listSavingsProducts(session.activeCooperative!.id);
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Savings products')),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<List<SavingsProduct>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return ErrorBanner(
                message: 'Could not load savings products: ${snapshot.error}',
              );
            }
            final products = snapshot.data ?? [];
            if (products.isEmpty) {
              return ListView(
                children: const [
                  Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('No savings products yet.'),
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
                    key: Key('savings-product-${p.code}'),
                    leading: const Icon(Icons.savings),
                    title: Text(p.name),
                    subtitle: Text(
                      '${p.code} · ${p.interestRatePercent}% interest · min balance ${formatNaira(p.minimumBalance)}',
                    ),
                    trailing: Chip(
                      label: Text(p.isActive ? 'Active' : 'Inactive'),
                    ),
                  ),
                );
              },
            );
          },
        ),
      ),
      floatingActionButton: FloatingActionButton(
        key: const Key('create-savings-product-fab'),
        tooltip: 'New savings product',
        onPressed: () async {
          final created = await Navigator.of(context).push<bool>(
            MaterialPageRoute(
              builder: (_) => const CreateSavingsProductScreen(),
            ),
          );
          if (created == true) _refresh();
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}

class CreateSavingsProductScreen extends StatefulWidget {
  const CreateSavingsProductScreen({super.key});

  @override
  State<CreateSavingsProductScreen> createState() =>
      _CreateSavingsProductScreenState();
}

class _CreateSavingsProductScreenState
    extends State<CreateSavingsProductScreen> {
  final _nameController = TextEditingController();
  final _codeController = TextEditingController();
  final _rateController = TextEditingController(text: '0');
  final _minBalanceController = TextEditingController(text: '0');
  bool _loading = false;
  String? _error;

  Future<void> _submit() async {
    if (_nameController.text.trim().isEmpty ||
        _codeController.text.trim().isEmpty) {
      setState(() => _error = 'Name and code are required.');
      return;
    }
    final rate = double.tryParse(_rateController.text);
    final minBalance = double.tryParse(_minBalanceController.text);
    if (rate == null || minBalance == null) {
      setState(
        () => _error = 'Enter valid numbers for rate and minimum balance.',
      );
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    final session = context.read<Session>();
    try {
      await session.api.createSavingsProduct(
        session.activeCooperative!.id,
        name: _nameController.text.trim(),
        code: _codeController.text.trim(),
        interestRatePercent: rate,
        minimumBalance: minBalance,
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
      appBar: AppBar(title: const Text('New savings product')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              key: const Key('product-name-field'),
              controller: _nameController,
              decoration: const InputDecoration(
                labelText: 'Name',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              key: const Key('product-code-field'),
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
              controller: _minBalanceController,
              decoration: const InputDecoration(
                labelText: 'Minimum balance (₦)',
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
              key: const Key('create-savings-product-submit'),
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
