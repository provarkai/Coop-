import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/session.dart';
import 'dashboard_screen.dart';
import 'savings_screen.dart';
import 'loans_screen.dart';
import 'meetings_screen.dart';
import 'notifications_screen.dart';
import 'members_screen.dart';
import 'cooperative_picker_screen.dart';

class _NavItem {
  final String label;
  final IconData icon;
  final Widget screen;
  final bool governanceOnly;
  const _NavItem(this.label, this.icon, this.screen, {this.governanceOnly = false});
}

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  static const _items = [
    _NavItem('Dashboard', Icons.dashboard, DashboardScreen()),
    _NavItem('Savings', Icons.savings, SavingsScreen()),
    _NavItem('Loans', Icons.request_quote, LoansScreen()),
    _NavItem('Meetings', Icons.event, MeetingsScreen()),
    _NavItem('Notifications', Icons.notifications, NotificationsScreen()),
    _NavItem('Members', Icons.people, MembersScreen(), governanceOnly: true),
  ];

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    final items = _items.where((i) => !i.governanceOnly || session.isGovernance).toList();
    final safeIndex = _index < items.length ? _index : 0;

    return Scaffold(
      appBar: AppBar(
        title: Text(session.activeCooperative?.name ?? 'NCMS'),
        actions: [
          PopupMenuButton<String>(
            onSelected: (value) {
              if (value == 'switch') {
                session.clearCooperative();
                Navigator.of(context).pushReplacement(
                  MaterialPageRoute(builder: (_) => const CooperativePickerScreen()),
                );
              } else if (value == 'logout') {
                session.logout();
              }
            },
            itemBuilder: (context) => const [
              PopupMenuItem(value: 'switch', child: Text('Switch cooperative')),
              PopupMenuItem(value: 'logout', child: Text('Log out')),
            ],
          ),
        ],
      ),
      body: items[safeIndex].screen,
      bottomNavigationBar: NavigationBar(
        selectedIndex: safeIndex,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: [
          for (final item in items) NavigationDestination(icon: Icon(item.icon), label: item.label),
        ],
      ),
    );
  }
}
