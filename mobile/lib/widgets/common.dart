import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

final _currencyFormat = NumberFormat.currency(locale: 'en_NG', symbol: '₦', decimalDigits: 2);

String formatNaira(String amount) {
  final value = double.tryParse(amount) ?? 0;
  return _currencyFormat.format(value);
}

/// Nigeria has no DST, so the whole app (matching the web frontend) treats West Africa Time
/// as a fixed UTC+1 offset -- never the device's own timezone.
const _watOffset = Duration(hours: 1);

/// Formats a UTC ISO-8601 instant from the API for display in WAT, regardless of the viewer's
/// own device timezone. Returns null if [iso] is null or unparseable.
String? formatUtcIsoAsWat(String? iso) {
  if (iso == null) return null;
  final utc = DateTime.tryParse(iso);
  if (utc == null) return iso;
  final wat = utc.toUtc().add(_watOffset);
  return '${wat.day.toString().padLeft(2, '0')}/${wat.month.toString().padLeft(2, '0')}/${wat.year} '
      '${wat.hour.toString().padLeft(2, '0')}:${wat.minute.toString().padLeft(2, '0')} WAT';
}

/// Converts a wall-clock date/time the user picked (e.g. from showDatePicker/showTimePicker,
/// whose year/month/day/hour/minute are exactly what was selected, uninfluenced by the device's
/// system timezone) into the true UTC instant to send to the API, treating those picked fields
/// as WAT -- the same convention the web app uses, so a meeting scheduled from a phone set to a
/// different timezone still lands on the wall-clock time the organizer actually picked.
String watWallClockToUtcIso(DateTime pickedWallClock) {
  final utcInstant = DateTime.utc(
    pickedWallClock.year,
    pickedWallClock.month,
    pickedWallClock.day,
    pickedWallClock.hour,
    pickedWallClock.minute,
  ).subtract(_watOffset);
  return utcInstant.toIso8601String();
}

class ErrorBanner extends StatelessWidget {
  final String message;
  const ErrorBanner({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      margin: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.errorContainer,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(message, style: TextStyle(color: Theme.of(context).colorScheme.onErrorContainer)),
    );
  }
}

class StatTile extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;

  const StatTile({super.key, required this.label, required this.value, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 8),
            Text(value, style: Theme.of(context).textTheme.titleLarge),
            Text(label, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}
