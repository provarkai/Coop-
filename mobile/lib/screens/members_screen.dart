import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_client.dart';
import '../state/session.dart';
import '../widgets/common.dart';

class MembersScreen extends StatefulWidget {
  const MembersScreen({super.key});

  @override
  State<MembersScreen> createState() => _MembersScreenState();
}

class _MembersScreenState extends State<MembersScreen> {
  late Future<List<Map<String, dynamic>>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Map<String, dynamic>>> _load() {
    final session = context.read<Session>();
    return session.api.listMembers(session.activeCooperative!.id);
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  Future<void> _act(Future<void> Function() action) async {
    try {
      await action();
      await _refresh();
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.read<Session>();
    return RefreshIndicator(
      onRefresh: _refresh,
      child: FutureBuilder<List<Map<String, dynamic>>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return ErrorBanner(message: 'Could not load members: ${snapshot.error}');
          }
          final members = snapshot.data ?? [];
          if (members.isEmpty) {
            return const Center(child: Text('No members yet.'));
          }
          final pending = members.where((m) => m['status'] == 'PENDING').toList();
          final active = members.where((m) => m['status'] != 'PENDING').toList();
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (pending.isNotEmpty) ...[
                Text('Pending applications', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                for (final m in pending)
                  Card(
                    child: ListTile(
                      key: Key('pending-member-${m['id']}'),
                      title: Text('${m['user']['firstName']} ${m['user']['lastName']}'),
                      subtitle: Text(m['user']['email'] as String),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.check_circle, color: Colors.green),
                            onPressed: () => _act(
                              () => session.api.approveMembership(session.activeCooperative!.id, m['userId'] as String),
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.cancel, color: Colors.red),
                            onPressed: () => _act(
                              () => session.api.rejectMembership(session.activeCooperative!.id, m['userId'] as String),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                const SizedBox(height: 16),
              ],
              Text('Members (${active.length})', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              for (final m in active)
                ListTile(
                  title: Text('${m['user']['firstName']} ${m['user']['lastName']}'),
                  subtitle: Text(m['user']['email'] as String),
                  trailing: Chip(label: Text(m['role'] as String)),
                ),
            ],
          );
        },
      ),
    );
  }
}
