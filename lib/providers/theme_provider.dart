import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dynamic_color/dynamic_color.dart';

class ThemeProvider with ChangeNotifier {
  static const String _themeModeKey = 'themeMode';
  
  ThemeMode _themeMode = ThemeMode.system;
  ColorScheme? _colorScheme;

  ThemeMode get themeMode => _themeMode;
  ColorScheme? get colorScheme => _colorScheme;

  ThemeProvider() {
    _loadSettings();
  }

  // Load settings from SharedPreferences
  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    final themeModeIndex = prefs.getInt(_themeModeKey) ?? ThemeMode.system.index;
    _themeMode = ThemeMode.values[themeModeIndex];
    notifyListeners();
  }

  // Save settings to SharedPreferences
  Future<void> _saveSettings() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_themeModeKey, _themeMode.index);
  }

  // Update ThemeMode
  void setThemeMode(ThemeMode mode) {
    if (_themeMode != mode) {
      _themeMode = mode;
      _saveSettings();
      notifyListeners();
    }
  }

  // Update ColorScheme
  void setColorScheme(ColorScheme? colorScheme) {
    if (_colorScheme != colorScheme) {
      _colorScheme = colorScheme;
      notifyListeners();
    }
  }
}
