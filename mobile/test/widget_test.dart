import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';

import 'package:ncms_mobile/api/api_client.dart';
import 'package:ncms_mobile/api/token_storage.dart';
import 'package:ncms_mobile/state/session.dart';
import 'package:ncms_mobile/screens/login_screen.dart';
import 'package:ncms_mobile/screens/root_screen.dart';

Widget _wrap(Session session, Widget child) {
  return ChangeNotifierProvider<Session>.value(
    value: session,
    child: MaterialApp(home: child),
  );
}

void main() {
  testWidgets('login screen shows the NCMS branding and empty fields', (tester) async {
    final client = ApiClient(baseUrl: 'http://test', storage: InMemoryTokenStorage());
    final session = Session(client);
    await tester.pumpWidget(_wrap(session, const LoginScreen()));

    expect(find.text('NCMS'), findsOneWidget);
    expect(find.byKey(const Key('email-field')), findsOneWidget);
    expect(find.byKey(const Key('password-field')), findsOneWidget);
    expect(find.byKey(const Key('mfa-field')), findsNothing);
  });

  testWidgets('failed login shows the exact server error message', (tester) async {
    final mockClient = MockClient((request) async {
      if (request.url.path == '/auth/login') {
        return http.Response(jsonEncode({'message': 'Invalid credentials'}), 401);
      }
      return http.Response('not found', 404);
    });
    final client = ApiClient(baseUrl: 'http://test', httpClient: mockClient, storage: InMemoryTokenStorage());
    final session = Session(client);
    await tester.pumpWidget(_wrap(session, const LoginScreen()));

    await tester.enterText(find.byKey(const Key('email-field')), 'demo-admin@ncms.example');
    await tester.enterText(find.byKey(const Key('password-field')), 'wrong-password');
    await tester.tap(find.byKey(const Key('login-submit')));
    await tester.pumpAndSettle();

    expect(find.text('Invalid credentials'), findsOneWidget);
    expect(session.currentUser, isNull);
  });

  testWidgets('login prompts for an MFA code when the backend requires one', (tester) async {
    var callCount = 0;
    final mockClient = MockClient((request) async {
      if (request.url.path == '/auth/login') {
        callCount++;
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        if (body['mfaCode'] == null) {
          return http.Response(jsonEncode({'message': 'MFA code required'}), 401);
        }
        return http.Response(
          jsonEncode({
            'user': {'id': 'u1', 'email': 'demo-admin@ncms.example', 'firstName': 'Demo', 'lastName': 'Admin', 'role': 'MEMBER'},
            'accessToken': 'access-1',
            'refreshToken': 'refresh-1',
          }),
          200,
        );
      }
      return http.Response('not found', 404);
    });
    final client = ApiClient(baseUrl: 'http://test', httpClient: mockClient, storage: InMemoryTokenStorage());
    final session = Session(client);
    await tester.pumpWidget(_wrap(session, const LoginScreen()));

    await tester.enterText(find.byKey(const Key('email-field')), 'demo-admin@ncms.example');
    await tester.enterText(find.byKey(const Key('password-field')), 'DemoPass123!');
    await tester.tap(find.byKey(const Key('login-submit')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('mfa-field')), findsOneWidget);
    expect(callCount, 1);

    await tester.enterText(find.byKey(const Key('mfa-field')), '123456');
    await tester.tap(find.byKey(const Key('login-submit')));
    await tester.pumpAndSettle();

    expect(callCount, 2);
    expect(session.currentUser?.email, 'demo-admin@ncms.example');
  });

  testWidgets('a session with no stored token lands on the login screen', (tester) async {
    final client = ApiClient(baseUrl: 'http://test', storage: InMemoryTokenStorage());
    final session = Session(client);
    await tester.pumpWidget(_wrap(session, const RootScreen()));
    await tester.pumpAndSettle();

    expect(find.byType(LoginScreen), findsOneWidget);
  });

  testWidgets('a session with a stored token restores straight past login', (tester) async {
    final storage = InMemoryTokenStorage();
    await storage.write('ncms_access_token', 'access-1');
    await storage.write('ncms_refresh_token', 'refresh-1');
    final mockClient = MockClient((request) async {
      if (request.url.path == '/auth/me') {
        return http.Response(
          jsonEncode({'id': 'u1', 'email': 'demo-admin@ncms.example', 'firstName': 'Demo', 'lastName': 'Admin', 'role': 'MEMBER'}),
          200,
        );
      }
      if (request.url.path == '/cooperatives') {
        return http.Response(jsonEncode([]), 200);
      }
      return http.Response('not found', 404);
    });
    final client = ApiClient(baseUrl: 'http://test', httpClient: mockClient, storage: storage);
    final session = Session(client);
    await tester.pumpWidget(_wrap(session, const RootScreen()));
    await tester.pumpAndSettle();

    expect(find.byType(LoginScreen), findsNothing);
    expect(session.currentUser?.firstName, 'Demo');
  });
}
