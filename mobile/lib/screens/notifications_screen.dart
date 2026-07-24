import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../state/session.dart';
import '../widgets/common.dart';

const _channels = ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH'];

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  late Future<List<AppNotification>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<AppNotification>> _load() {
    final session = context.read<Session>();
    final coopId = session.activeCooperative!.id;
    if (session.isGovernance) {
      return session.api.listAllNotifications(coopId);
    }
    return session.api.listMyNotifications(coopId);
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  IconData _channelIcon(String channel) {
    switch (channel) {
      case 'EMAIL':
        return Icons.email;
      case 'SMS':
        return Icons.sms;
      case 'WHATSAPP':
        return Icons.chat;
      case 'PUSH':
        return Icons.notifications;
      default:
        return Icons.notifications;
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<List<AppNotification>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return ErrorBanner(message: 'Could not load notifications: ${snapshot.error}');
            }
            final items = snapshot.data ?? [];
            if (items.isEmpty) {
              return ListView(
                children: const [
                  Padding(padding: EdgeInsets.all(24), child: Text('No notifications yet.')),
                ],
              );
            }
            return ListView.separated(
              itemCount: items.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, i) {
                final n = items[i];
                return ListTile(
                  key: Key('notification-${n.id}'),
                  leading: Icon(_channelIcon(n.channel)),
                  title: Text(n.subject ?? n.body, maxLines: 1, overflow: TextOverflow.ellipsis),
                  subtitle: Text(n.body, maxLines: 2, overflow: TextOverflow.ellipsis),
                  trailing: Chip(
                    label: Text(n.status),
                    backgroundColor: (n.status == 'SENT' ? Colors.green : Colors.red).withValues(alpha: 0.15),
                  ),
                );
              },
            );
          },
        ),
      ),
      floatingActionButton: session.isGovernance
          ? FloatingActionButton.extended(
              key: const Key('send-announcement-fab'),
              icon: const Icon(Icons.campaign),
              label: const Text('Announce'),
              onPressed: () async {
                final sent = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(builder: (_) => const SendAnnouncementScreen()),
                );
                if (sent == true) _refresh();
              },
            )
          : null,
    );
  }
}

class SendAnnouncementScreen extends StatefulWidget {
  const SendAnnouncementScreen({super.key});

  @override
  State<SendAnnouncementScreen> createState() => _SendAnnouncementScreenState();
}

class _SendAnnouncementScreenState extends State<SendAnnouncementScreen> {
  String _channel = _channels.first;
  final _subjectController = TextEditingController();
  final _bodyController = TextEditingController();
  bool _loading = false;
  String? _error;

  Future<void> _submit() async {
    if (_bodyController.text.trim().isEmpty) {
      setState(() => _error = 'Message body is required.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    final session = context.read<Session>();
    try {
      await session.api.sendAnnouncement(
        session.activeCooperative!.id,
        _channel,
        _bodyController.text.trim(),
        subject: _subjectController.text.trim().isEmpty ? null : _subjectController.text.trim(),
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
      appBar: AppBar(title: const Text('Send announcement')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'This is simulated: the message is logged to every active member\'s notification '
              'feed on the chosen channel, but nothing is actually sent to a real inbox or phone.',
              style: TextStyle(fontStyle: FontStyle.italic),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              initialValue: _channel,
              decoration: const InputDecoration(labelText: 'Channel', border: OutlineInputBorder()),
              items: _channels.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
              onChanged: (v) => setState(() => _channel = v!),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _subjectController,
              decoration: const InputDecoration(labelText: 'Subject (optional)', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _bodyController,
              decoration: const InputDecoration(labelText: 'Message', border: OutlineInputBorder()),
              maxLines: 4,
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _loading ? null : _submit,
              child: _loading
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Send (simulated)'),
            ),
          ],
        ),
      ),
    );
  }
}
