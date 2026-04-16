import 'package:flutter/material.dart';

import 'src/agent_app.dart';
import 'src/backend_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // No Firebase initialization needed — using REST API with JWT
  await BackendService.initialize();
  runApp(const AgentRoot());
}

class AgentRoot extends StatelessWidget {
  const AgentRoot({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'dRecharge Agent',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF134235),
          brightness: Brightness.light,
        ),
        scaffoldBackgroundColor: const Color(0xFFF5F7F5),
        useMaterial3: true,
      ),
      home: const AgentApp(),
    );
  }
}
