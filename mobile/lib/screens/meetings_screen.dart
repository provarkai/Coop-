import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../state/session.dart';
import '../widgets/common.dart';
import 'create_meeting_screen.dart';

class MeetingsScreen extends StatefulWidget {
  const MeetingsScreen({super.key});

  @override
  State<MeetingsScreen> createState() => _MeetingsScreenState();
}

class _MeetingsScreenState extends State<MeetingsScreen> {
  late Future<List<Meeting>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Meeting>> _load() {
    final session = context.read<Session>();
    return session.api.listMeetings(session.activeCooperative!.id);
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  Future<void> _rsvp(Meeting meeting, String status) async {
    final session = context.read<Session>();
    try {
      await session.api.rsvpToMeeting(
        session.activeCooperative!.id,
        meeting.id,
        status,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('RSVP recorded: $status')));
      }
      _refresh();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  String _formatDate(String iso) {
    final dt = DateTime.tryParse(iso);
    if (dt == null) return iso;
    return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year} '
        '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')} WAT';
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<List<Meeting>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return ErrorBanner(
                message: 'Could not load meetings: ${snapshot.error}',
              );
            }
            final meetings = snapshot.data ?? [];
            if (meetings.isEmpty) {
              return ListView(
                children: const [
                  Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('No meetings scheduled.'),
                  ),
                ],
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: meetings.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final meeting = meetings[i];
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          meeting.title,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        Text(
                          '${meeting.type} · ${_formatDate(meeting.scheduledAt)}',
                        ),
                        if (meeting.location != null) Text(meeting.location!),
                        Text('Status: ${meeting.status}'),
                        if (meeting.status == 'SCHEDULED')
                          Row(
                            children: [
                              TextButton(
                                onPressed: () => _rsvp(meeting, 'CONFIRMED'),
                                child: const Text('RSVP yes'),
                              ),
                              TextButton(
                                onPressed: () => _rsvp(meeting, 'DECLINED'),
                                child: const Text('RSVP no'),
                              ),
                            ],
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
          ? FloatingActionButton(
              key: const Key('create-meeting-fab'),
              tooltip: 'Schedule meeting',
              onPressed: () async {
                final created = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(
                    builder: (_) => const CreateMeetingScreen(),
                  ),
                );
                if (created == true) _refresh();
              },
              child: const Icon(Icons.add),
            )
          : null,
    );
  }
}
