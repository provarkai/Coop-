import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'api/api_client.dart';
import 'state/session.dart';
import 'screens/root_screen.dart';

const _defaultApiUrl = String.fromEnvironment('API_URL', defaultValue: 'http://localhost:3001');

void main() {
  runApp(NcmsApp(apiUrl: _defaultApiUrl));
}

class NcmsApp extends StatelessWidget {
  final String apiUrl;
  const NcmsApp({super.key, required this.apiUrl});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => Session(ApiClient(baseUrl: apiUrl)),
      child: MaterialApp(
        title: 'NCMS',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorSchemeSeed: const Color(0xFF166534),
          useMaterial3: true,
          fontFamily: 'Roboto',
        ),
        home: const RootScreen(),
      ),
    );
  }
}
