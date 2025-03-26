import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:collect/pages/collection_page.dart';
import 'package:collect/providers/theme_provider.dart';
import 'package:collect/themes/app_themes.dart';

void main() async { // Make main async
  WidgetsFlutterBinding.ensureInitialized(); // Ensure bindings are initialized
  // ThemeProvider handles its own loading via constructor
  runApp(
    ChangeNotifierProvider( // Wrap with Provider
      create: (_) => ThemeProvider(),
      child: MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    // Consume the ThemeProvider to rebuild when theme changes
    final themeProvider = Provider.of<ThemeProvider>(context);

    return MaterialApp(
      title: 'Collect App', // Added title
      // Apply dynamic themes based on provider state
      theme: AppThemes.getTheme(themeProvider.primaryColor, Brightness.light),
      darkTheme: AppThemes.getTheme(themeProvider.primaryColor, Brightness.dark),
      themeMode: themeProvider.themeMode,
      home: CollectionPage(),
      debugShowCheckedModeBanner: false, // Optional: hide debug banner
    );
  }
}
