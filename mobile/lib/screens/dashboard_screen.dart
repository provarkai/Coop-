import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../state/session.dart';
import '../widgets/common.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  DashboardSummary? _summary;
  bool _governanceView = true;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final session = context.read<Session>();
    final coopId = session.activeCooperative!.id;
    try {
      // The KPI dashboard is governance-only server-side; a 403 here just means
      // this member sees the plain-member summary instead (same pattern as the web app).
      final summary = await session.api.getDashboard(coopId);
      setState(() {
        _summary = summary;
        _governanceView = true;
      });
    } on ApiException catch (e) {
      if (e.status == 403) {
        setState(() => _governanceView = false);
      } else {
        setState(() => _error = e.message);
      }
    } catch (e) {
      setState(() => _error = 'Could not load the dashboard.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) return ErrorBanner(message: _error!);

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Welcome, ${session.currentUser?.firstName ?? ''}', style: Theme.of(context).textTheme.headlineSmall),
          Text(session.activeCooperative?.name ?? '', style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 16),
          if (_governanceView && _summary != null) ..._governanceTiles(_summary!) else _memberSummary(context),
        ],
      ),
    );
  }

  List<Widget> _governanceTiles(DashboardSummary s) {
    return [
      GridView.count(
        crossAxisCount: 2,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 1.3,
        children: [
          StatTile(label: 'Active members', value: '${s.activeMembers}', icon: Icons.people),
          StatTile(label: 'Pending applications', value: '${s.pendingApplications}', icon: Icons.pending_actions),
          StatTile(label: 'Total savings', value: formatNaira(s.totalSavingsBalance), icon: Icons.savings),
          StatTile(label: 'Outstanding loans', value: formatNaira(s.totalOutstandingLoans), icon: Icons.request_quote),
          StatTile(label: 'Upcoming meetings', value: '${s.upcomingMeetings}', icon: Icons.event),
          StatTile(label: 'Open resolutions', value: '${s.openResolutions}', icon: Icons.how_to_vote),
          StatTile(label: 'Cash balance', value: formatNaira(s.cashBalance), icon: Icons.account_balance_wallet),
          StatTile(label: 'Net surplus', value: formatNaira(s.netSurplus), icon: Icons.trending_up),
        ],
      ),
    ];
  }

  Widget _memberSummary(BuildContext context) {
    return const Card(
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Use the tabs below to check your savings balance, loan status, and upcoming meetings.'),
          ],
        ),
      ),
    );
  }
}
