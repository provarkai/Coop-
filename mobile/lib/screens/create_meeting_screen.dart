import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_client.dart';
import '../state/session.dart';

const _meetingTypes = ['AGM', 'BOARD', 'COMMITTEE', 'SPECIAL'];

class CreateMeetingScreen extends StatefulWidget {
  const CreateMeetingScreen({super.key});

  @override
  State<CreateMeetingScreen> createState() => _CreateMeetingScreenState();
}

class _CreateMeetingScreenState extends State<CreateMeetingScreen> {
  final _titleController = TextEditingController();
  final _locationController = TextEditingController();
  final _agendaItemController = TextEditingController();
  String _type = 'BOARD';
  DateTime? _scheduledAt;
  final List<String> _agendaItems = [];
  bool _loading = false;
  String? _error;

  Future<void> _pickDateTime() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: now.add(const Duration(days: 7)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 365 * 2)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(now),
    );
    if (time == null) return;
    setState(() {
      _scheduledAt = DateTime(
        date.year,
        date.month,
        date.day,
        time.hour,
        time.minute,
      );
    });
  }

  void _addAgendaItem() {
    final text = _agendaItemController.text.trim();
    if (text.isEmpty) return;
    setState(() {
      _agendaItems.add(text);
      _agendaItemController.clear();
    });
  }

  Future<void> _submit() async {
    if (_titleController.text.trim().isEmpty) {
      setState(() => _error = 'Title is required.');
      return;
    }
    if (_scheduledAt == null) {
      setState(() => _error = 'Pick a date and time.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    final session = context.read<Session>();
    try {
      await session.api.createMeeting(
        session.activeCooperative!.id,
        title: _titleController.text.trim(),
        type: _type,
        scheduledAt: _scheduledAt!,
        location: _locationController.text.trim(),
        agendaItems: _agendaItems,
      );
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _formatDateTime(DateTime dt) {
    return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year} '
        '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')} WAT';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Schedule meeting')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              key: const Key('meeting-title-field'),
              controller: _titleController,
              decoration: const InputDecoration(
                labelText: 'Title',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _type,
              decoration: const InputDecoration(
                labelText: 'Type',
                border: OutlineInputBorder(),
              ),
              items: _meetingTypes
                  .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                  .toList(),
              onChanged: (v) => setState(() => _type = v!),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              key: const Key('pick-datetime-button'),
              onPressed: _pickDateTime,
              icon: const Icon(Icons.event),
              label: Text(
                _scheduledAt == null
                    ? 'Pick date & time (WAT)'
                    : _formatDateTime(_scheduledAt!),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _locationController,
              decoration: const InputDecoration(
                labelText: 'Location (optional)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Agenda items (optional)',
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    key: const Key('agenda-item-field'),
                    controller: _agendaItemController,
                    decoration: const InputDecoration(
                      hintText: 'Agenda item title',
                      border: OutlineInputBorder(),
                    ),
                    onSubmitted: (_) => _addAgendaItem(),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.add_circle),
                  onPressed: _addAgendaItem,
                ),
              ],
            ),
            for (final item in _agendaItems)
              ListTile(
                dense: true,
                title: Text(item),
                trailing: IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => setState(() => _agendaItems.remove(item)),
                ),
              ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
            const SizedBox(height: 20),
            FilledButton(
              key: const Key('create-meeting-submit'),
              onPressed: _loading ? null : _submit,
              child: _loading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Schedule meeting'),
            ),
          ],
        ),
      ),
    );
  }
}
