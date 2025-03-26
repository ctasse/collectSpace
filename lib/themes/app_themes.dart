import 'package:flutter/material.dart';

class AppThemes {
  // Function to generate ThemeData based on primary color and brightness
  static ThemeData getTheme(MaterialColor primaryColor, Brightness brightness) {
    final baseTheme = brightness == Brightness.dark
        ? ThemeData.dark()
        : ThemeData.light();

    return baseTheme.copyWith(
      colorScheme: ColorScheme.fromSwatch(
        primarySwatch: primaryColor,
        brightness: brightness,
      ),
      // You can customize other theme properties here if needed
      // e.g., appBarTheme, textTheme, buttonTheme, etc.
      appBarTheme: baseTheme.appBarTheme.copyWith(
        backgroundColor: brightness == Brightness.dark ? Colors.black : primaryColor,
        foregroundColor: brightness == Brightness.dark ? Colors.white : null, // Use default for light
        elevation: 4.0,
      ),
      scaffoldBackgroundColor: brightness == Brightness.dark ? Colors.black : Colors.grey[100],
      // Example: Customize floating action button theme
      floatingActionButtonTheme: baseTheme.floatingActionButtonTheme.copyWith(
        backgroundColor: primaryColor,
      ),
      // Example: Customize card theme
      cardTheme: baseTheme.cardTheme.copyWith(
        elevation: 2.0,
        margin: const EdgeInsets.symmetric(vertical: 8.0, horizontal: 16.0),
      ),
      // Example: Customize ListTile theme
      listTileTheme: baseTheme.listTileTheme.copyWith(
        iconColor: primaryColor,
      ),
      // Ensure text selection handles are visible in both modes
      textSelectionTheme: baseTheme.textSelectionTheme.copyWith(
        cursorColor: primaryColor,
        selectionColor: primaryColor.withOpacity(0.4),
        selectionHandleColor: primaryColor,
      ),
    );
  }

  // You could define specific named themes here if needed,
  // but generating dynamically based on color is more flexible.
  // static final ThemeData lightTheme = getTheme(Colors.blue, Brightness.light);
  // static final ThemeData darkTheme = getTheme(Colors.blue, Brightness.dark);
}
