import 'package:flutter/material.dart';

class SearchPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    // Removed Scaffold backgroundColor
    return Scaffold(
      appBar: AppBar(
        // Removed title style and backgroundColor
        title: const Text('搜索'),
        // Let the theme handle the back button icon color automatically
      ),
      // Removed Scaffold backgroundColor
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            TextField(
              // Removed style color, let theme handle text color
              decoration: InputDecoration(
                hintText: '输入关键词搜索',
                // Removed hintStyle color, let theme handle hint color
                // Removed fillColor, let theme handle input decoration fill
                // Consider adjusting theme's inputDecorationTheme if needed
                filled: true, // Keep filled for contrast, theme should provide color
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide.none,
                ),
                // Removed prefixIcon color, let theme handle icon color
                prefixIcon: const Icon(Icons.search),
              ),
              onChanged: (value) {
                // 实时搜索逻辑
              },
            ),
            const SizedBox(height: 16),
            Expanded(
              child: Center(
                child: Text(
                  '搜索结果将显示在这里',
                  // Removed style color, let theme handle default text color
                  // Use Theme.of(context).textTheme.bodySmall or similar for specific styling if needed
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
