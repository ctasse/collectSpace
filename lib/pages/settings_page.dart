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
          _buildThemeColorSection(context, themeProvider, textColor, iconColor),
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
            style: TextStyle(color: themeProvider.primaryColor, fontWeight: FontWeight.bold),
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

  // Section for Theme Color selection
  Widget _buildThemeColorSection(BuildContext context, ThemeProvider themeProvider, Color textColor, Color? iconColor) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
         Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
          child: Text(
            '主题颜色',
             style: TextStyle(color: themeProvider.primaryColor, fontWeight: FontWeight.bold),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
          child: Wrap(
            spacing: 12.0, // Horizontal space between colors
            runSpacing: 8.0, // Vertical space between lines
            children: themeProvider.availableColors.map((color) {
              bool isSelected = themeProvider.primaryColor.value == color.value;
              return GestureDetector(
                onTap: () => themeProvider.setPrimaryColor(color),
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: color,
                    shape: BoxShape.circle,
                    border: isSelected
                        ? Border.all(color: textColor.withOpacity(0.7), width: 3)
                        : null,
                    boxShadow: isSelected
                        ? [BoxShadow(color: Colors.black.withOpacity(0.3), blurRadius: 3, spreadRadius: 1)]
                        : null,
                  ),
                  // Optional: Add a checkmark for the selected color
                  child: isSelected
                      ? Icon(Icons.check, color: Colors.white.withOpacity(0.8), size: 24)
                      : null,
                ),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }
}
