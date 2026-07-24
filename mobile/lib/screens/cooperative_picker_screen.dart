import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/models.dart';
import '../state/session.dart';
import 'home_shell.dart';

class CooperativePickerScreen extends StatefulWidget {
  const CooperativePickerScreen({super.key});

  @override
  State<CooperativePickerScreen> createState() => _CooperativePickerScreenState();
}

class _CooperativePickerScreenState extends State<CooperativePickerScreen> {
  late Future<List<Cooperative>> _future;

  @override
  void initState() {
    super.initState();
    _future = context.read<Session>().api.listCooperatives();
  }

  Future<void> _select(Cooperative coop) async {
    await context.read<Session>().selectCooperative(coop);
    if (mounted) {
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const HomeShell()));
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    return Scaffold(
      appBar: AppBar(
        title: const Text('My cooperatives'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Log out',
            onPressed: () => session.logout(),
          ),
        ],
      ),
      body: FutureBuilder<List<Cooperative>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Text('Could not load cooperatives: ${snapshot.error}'));
          }
          final coops = snapshot.data ?? [];
          if (coops.isEmpty) {
            return const Center(child: Text('You are not a member of any cooperative yet.'));
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: coops.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, i) {
              final coop = coops[i];
              return Card(
                child: ListTile(
                  key: Key('coop-${coop.slug}'),
                  leading: const Icon(Icons.groups_2),
                  title: Text(coop.name),
                  subtitle: Text(coop.slug),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _select(coop),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
