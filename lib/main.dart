import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:collect/pages/collection_page.dart';
import 'package:collect/providers/theme_provider.dart';
import 'package:collect/themes/app_themes.dart';
import 'package:dynamic_color/dynamic_color.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    ChangeNotifierProvider(
      create: (_) => ThemeProvider(),
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  ColorScheme? _colorScheme;

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);

    return DynamicColorBuilder(
      builder: (lightDynamic, darkDynamic) {
        if (lightDynamic != null && _colorScheme == null) {
          _colorScheme = ColorScheme.fromSeed(
            seedColor: lightDynamic.primary,
            brightness: Brightness.light,
          );
        }

        return MaterialApp(
          title: 'Collect App',
          theme: AppThemes.getTheme(_colorScheme, Brightness.light),
          darkTheme: AppThemes.getTheme(_colorScheme, Brightness.dark),
          themeMode: themeProvider.themeMode,
          home: CollectionPage(),
          debugShowCheckedModeBanner: false,
        );
      },
    );
  }
}
