import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dynamic_color/dynamic_color.dart';

class ThemeProvider with ChangeNotifier {
  static const String _themeModeKey = 'themeMode';
  
  ThemeMode _themeMode = ThemeMode.system;
  ColorScheme? _lightColorScheme;
  ColorScheme? _darkColorScheme;

  ThemeMode get themeMode => _themeMode;
  ColorScheme? get lightColorScheme => _lightColorScheme;
  ColorScheme? get darkColorScheme => _darkColorScheme;

  ThemeProvider() {
    _initialize();
  }

  Future<void> _initialize() async {
    await _loadSettings();
    // 强制生成默认亮色主题
    _lightColorScheme = ColorScheme.fromSeed(
      seedColor: Colors.blue,
      brightness: Brightness.light,
    );
    // 强制生成默认深色主题
    _darkColorScheme = ColorScheme.fromSeed(
      seedColor: Colors.blue,
      brightness: Brightness.dark,
    );
    // _initialize 完成后通知一次，确保初始主题可用
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

  // Update ColorSchemes based on dynamic colors
  void setColorSchemes(ColorScheme? lightScheme, ColorScheme? darkScheme) {
    bool changed = false;
    if (lightScheme != null && _lightColorScheme != lightScheme) {
      _lightColorScheme = lightScheme;
      changed = true;
    }
     if (darkScheme != null && _darkColorScheme != darkScheme) {
      _darkColorScheme = darkScheme;
      changed = true;
    }

    // 如果没有动态颜色，确保有默认值
    _lightColorScheme ??= ColorScheme.fromSeed(seedColor: Colors.blue, brightness: Brightness.light);
    _darkColorScheme ??= ColorScheme.fromSeed(seedColor: Colors.blue, brightness: Brightness.dark);

    if (changed) {
      notifyListeners();
    }
  }

  // Getters for light and dark themes with null safety fallback
  ThemeData get lightTheme {
    final scheme = _lightColorScheme ?? ColorScheme.fromSeed(seedColor: Colors.blue, brightness: Brightness.light);
    return _generateTheme(scheme, Brightness.light);
  }
  ThemeData get darkTheme {
     final scheme = _darkColorScheme ?? ColorScheme.fromSeed(seedColor: Colors.blue, brightness: Brightness.dark);
    return _generateTheme(scheme, Brightness.dark);
  }

  // 生成主题数据
  // Helper method to generate ThemeData
  ThemeData _generateTheme(ColorScheme colorScheme, Brightness brightness) {
    // Ensure the provided colorScheme matches the brightness, otherwise fallback
    final effectiveColorScheme = colorScheme.brightness == brightness
        ? colorScheme
        : ColorScheme.fromSeed(
            seedColor: Colors.blue, // Fallback seed color
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
