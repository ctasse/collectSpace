import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ThemeProvider with ChangeNotifier {
  static const String _themeModeKey = 'themeMode';
  static const String _primaryColorKey = 'primaryColor';

  ThemeMode _themeMode = ThemeMode.system;
  MaterialColor _primaryColor = Colors.blue; // Default primary color

  ThemeMode get themeMode => _themeMode;
  MaterialColor get primaryColor => _primaryColor;

  ThemeProvider() {
    _loadSettings();
  }

  // Load settings from SharedPreferences
  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    final themeModeIndex = prefs.getInt(_themeModeKey) ?? ThemeMode.system.index;
    final primaryColorValue = prefs.getInt(_primaryColorKey) ?? Colors.blue.value;

    _themeMode = ThemeMode.values[themeModeIndex];
    _primaryColor = _findMaterialColor(primaryColorValue); // Find MaterialColor from value

    notifyListeners();
  }

  // Save settings to SharedPreferences
  Future<void> _saveSettings() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_themeModeKey, _themeMode.index);
    await prefs.setInt(_primaryColorKey, _primaryColor.value);
  }

  // Update ThemeMode
  void setThemeMode(ThemeMode mode) {
    if (_themeMode != mode) {
      _themeMode = mode;
      _saveSettings();
      notifyListeners();
    }
  }

  // Update Primary Color
  void setPrimaryColor(MaterialColor color) {
    if (_primaryColor != color) {
      _primaryColor = color;
      _saveSettings();
      notifyListeners();
    }
  }

  // Helper to find MaterialColor from its value (needed for loading)
  // You might need to expand this list if you offer more colors
  MaterialColor _findMaterialColor(int value) {
    if (value == Colors.blue.value) return Colors.blue;
    if (value == Colors.green.value) return Colors.green;
    if (value == Colors.red.value) return Colors.red;
    if (value == Colors.purple.value) return Colors.purple;
    if (value == Colors.orange.value) return Colors.orange;
    if (value == Colors.teal.value) return Colors.teal;
    // Add more colors as needed
    return Colors.blue; // Default fallback
  }

  // List of available colors for the settings page
  List<MaterialColor> get availableColors => [
    Colors.blue,
    Colors.green,
    Colors.red,
    Colors.purple,
    Colors.orange,
    Colors.teal,
    // Add more colors as needed
  ];
}
