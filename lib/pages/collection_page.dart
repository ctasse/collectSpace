import 'package:collect/widgets/category_menu.dart';
import 'package:flutter/material.dart';
import 'package:collect/widgets/collection_item.dart';
import 'package:collect/models/item.dart';
import 'package:collect/pages/settings_page.dart';
import 'package:collect/pages/search_page.dart';

class CollectionPage extends StatelessWidget {
  final List<CollectionItemModel> items = [];

  @override
  Widget build(BuildContext context) {
    // Removed Scaffold backgroundColor to use theme's scaffoldBackgroundColor
    return Scaffold(
      appBar: AppBar(
        // Removed AppBar backgroundColor to use theme's appBarTheme.backgroundColor
        // Removed hardcoded text style to use theme's appBarTheme.titleTextStyle or default
        title: const Text('收藏空间'),
        actions: [
          IconButton(
            // Removed hardcoded icon color to use theme's appBarTheme.iconTheme.color or default
            icon: const Icon(Icons.search),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => SearchPage()),
              );
            },
          ),
          IconButton(
            // Removed hardcoded icon color
            icon: const Icon(Icons.filter_alt),
            onPressed: () {
              // 显示分类选单
              showModalBottomSheet(
                context: context,
                // Let bottom sheet theme handle background color
                builder: (context) => CategoryMenu(),
              );
            },
          ),
          IconButton(
            // Removed hardcoded icon color
            icon: const Icon(Icons.settings),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => SettingsPage()),
              );
            },
          ),
        ],
      ),
      body: GridView.builder(
        padding: const EdgeInsets.all(8),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          childAspectRatio: 1.0,
          crossAxisSpacing: 8,
          mainAxisSpacing: 8,
        ),
        itemCount: items.length,
        itemBuilder: (context, index) {
          return CollectionItem(item: items[index]);
        },
      ),
    );
  }
}
