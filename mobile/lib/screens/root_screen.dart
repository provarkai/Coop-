import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/session.dart';
import 'login_screen.dart';
import 'cooperative_picker_screen.dart';

class RootScreen extends StatefulWidget {
  const RootScreen({super.key});

  @override
  State<RootScreen> createState() => _RootScreenState();
}

class _RootScreenState extends State<RootScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<Session>().restoreSession();
    });
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    if (session.restoring) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (session.currentUser == null) {
      return const LoginScreen();
    }
    return const CooperativePickerScreen();
  }
}
