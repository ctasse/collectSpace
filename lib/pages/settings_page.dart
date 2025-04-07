import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:collect/providers/theme_provider.dart';

class SettingsPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    // Use watch to rebuild when theme changes
    final themeProvider = context.watch<ThemeProvider>();
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDarkMode ? Colors.white : Colors.black;
    final iconColor = isDarkMode ? Colors.white : Colors.grey[700];

    return Scaffold(
      // AppBar theme will be handled by MaterialApp theme settings later
      appBar: AppBar(
        title: const Text('设置'),
        // Remove hardcoded colors later when main.dart is updated
        // style: TextStyle(color: textColor)),
        // backgroundColor: Theme.of(context).appBarTheme.backgroundColor,
      ),
      // Scaffold background color will be handled by MaterialApp theme settings later
      // backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: ListView(
        children: [
          _buildThemeModeSection(context, themeProvider, textColor, iconColor),
          const Divider(),
          ListTile(
            leading: Icon(Icons.notifications, color: iconColor),
            title: Text('通知设置', style: TextStyle(color: textColor)),
            onTap: () {
              // TODO: Implement navigation
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('通知设置待实现')),
              );
            },
          ),
          ListTile(
            leading: Icon(Icons.info, color: iconColor),
            title: Text('关于', style: TextStyle(color: textColor)),
            onTap: () {
              // TODO: Implement navigation
               ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('关于页面待实现')),
              );
            },
          ),
        ],
      ),
    );
  }

  // Section for Theme Mode (Light/Dark/System)
  Widget _buildThemeModeSection(BuildContext context, ThemeProvider themeProvider, Color textColor, Color? iconColor) {
    final bool isSystemMode = themeProvider.themeMode == ThemeMode.system;
    // Determine if dark mode is effectively active (either forced or via system)
    final bool isEffectivelyDark = themeProvider.themeMode == ThemeMode.dark ||
                                   (isSystemMode && MediaQuery.of(context).platformBrightness == Brightness.dark);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
         Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
          child: Text(
            '外观模式',
            style: TextStyle(color: Theme.of(context).colorScheme.primary, fontWeight: FontWeight.bold),
          ),
        ),
        SwitchListTile(
          title: Text('跟随系统', style: TextStyle(color: textColor)),
          secondary: Icon(Icons.settings_brightness, color: iconColor),
          value: isSystemMode,
          onChanged: (value) {
            themeProvider.setThemeMode(value ? ThemeMode.system : (isEffectivelyDark ? ThemeMode.dark : ThemeMode.light));
          },
        ),
        SwitchListTile(
          title: Text('深色模式', style: TextStyle(color: textColor)),
          secondary: Icon(Icons.dark_mode, color: iconColor),
          value: isEffectivelyDark,
          // Disable this switch if 'Follow System' is enabled
          onChanged: isSystemMode ? null : (value) {
            themeProvider.setThemeMode(value ? ThemeMode.dark : ThemeMode.light);
          },
        ),
      ],
    );
  }
}
