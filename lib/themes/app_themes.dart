import 'package:flutter/material.dart';
import 'package:material_color_utilities/material_color_utilities.dart';

class AppThemes {
  // Function to generate ThemeData based on primary color and brightness
  static ThemeData getTheme(ColorScheme? colorScheme, Brightness brightness) {
    final baseTheme = brightness == Brightness.dark
        ? ThemeData.dark()
        : ThemeData.light();

    final effectiveColorScheme = colorScheme ?? ColorScheme.fromSeed(
      seedColor: Colors.blue,
      brightness: brightness,
    );

    return baseTheme.copyWith(
      colorScheme: effectiveColorScheme,
      useMaterial3: true,
      appBarTheme: AppBarTheme(
        backgroundColor: effectiveColorScheme.surface,
        foregroundColor: effectiveColorScheme.onSurface,
        elevation: 0,
      ),
      scaffoldBackgroundColor: effectiveColorScheme.background,
      cardTheme: CardTheme(
        elevation: 2.0,
        margin: const EdgeInsets.symmetric(vertical: 8.0, horizontal: 16.0),
        color: effectiveColorScheme.surface,
      ),
      listTileTheme: ListTileThemeData(
        iconColor: effectiveColorScheme.primary,
      ),
      textSelectionTheme: TextSelectionThemeData(
        cursorColor: effectiveColorScheme.primary,
        selectionColor: effectiveColorScheme.primary.withOpacity(0.4),
        selectionHandleColor: effectiveColorScheme.primary,
      ),
    );
  }

  // You could define specific named themes here if needed,
  // but generating dynamically based on color is more flexible.
  // static final ThemeData lightTheme = getTheme(Colors.blue, Brightness.light);
  // static final ThemeData darkTheme = getTheme(Colors.blue, Brightness.dark);
}
