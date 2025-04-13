import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:collect/pages/collection_page.dart';
import 'package:collect/providers/theme_provider.dart';
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
  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);

    return DynamicColorBuilder(
      builder: (lightDynamic, darkDynamic) {
        ColorScheme? lightColorScheme;
        ColorScheme? darkColorScheme;

        if (lightDynamic != null) {
          lightColorScheme = ColorScheme.fromSeed(
            seedColor: lightDynamic.primary,
            brightness: Brightness.light,
          );
        }
        if (darkDynamic != null) {
          darkColorScheme = ColorScheme.fromSeed(
            seedColor: darkDynamic.primary,
            brightness: Brightness.dark,
          );
        }

        // 使用 scheduleMicrotask 确保在 build 之后更新状态
        scheduleMicrotask(() {
          themeProvider.setColorSchemes(lightColorScheme, darkColorScheme);
        });

        return MaterialApp(
          title: 'Collect App',
          theme: themeProvider.lightTheme,
          darkTheme: themeProvider.darkTheme,
          themeMode: themeProvider.themeMode,
          home: CollectionPage(),
          debugShowCheckedModeBanner: false,
        );
      },
    );
  }
}
