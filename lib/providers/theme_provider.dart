import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dynamic_color/dynamic_color.dart';

class ThemeProvider with ChangeNotifier {
  static const String _themeModeKey = 'themeMode';
  
  ThemeMode _themeMode = ThemeMode.system;
  ColorScheme? _colorScheme;
  bool _isInitialized = false;

  ThemeMode get themeMode => _themeMode;
  ColorScheme? get colorScheme => _colorScheme;

  ThemeProvider() {
    _initialize();
  }

  Future<void> _initialize() async {
    await _loadSettings();
    // 预生成默认主题
    _colorScheme = ColorScheme.fromSeed(
      seedColor: Colors.blue,
      brightness: Brightness.light,
    );
    notifyListeners();
  }

  // Load settings from SharedPreferences
  Future<void> _loadSettings() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final themeModeIndex = prefs.getInt(_themeModeKey) ?? ThemeMode.system.index;
      _themeMode = ThemeMode.values[themeModeIndex];
    } catch (e) {
      // 如果加载失败，使用默认值
      _themeMode = ThemeMode.system;
    }
  }

  // Save settings to SharedPreferences
  Future<void> _saveSettings() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setInt(_themeModeKey, _themeMode.index);
    } catch (e) {
      // 保存失败时静默处理
    }
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
    if (!_isInitialized && colorScheme != null) {
      _colorScheme = colorScheme;
      _isInitialized = true;
      notifyListeners();
    }
  }

  // 生成主题数据
  ThemeData getTheme(Brightness brightness) {
    final effectiveColorScheme = _colorScheme ?? ColorScheme.fromSeed(
      seedColor: Colors.blue,
      brightness: brightness,
    );

    return ThemeData(
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
}
