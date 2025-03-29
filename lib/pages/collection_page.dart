import 'package:collect/widgets/category_menu.dart';
import 'package:flutter/material.dart';
import 'package:collect/widgets/collection_item.dart';
import 'package:collect/models/item.dart';
import 'package:collect/pages/settings_page.dart';
import 'package:collect/pages/search_page.dart';
import 'package:flutter/services.dart';

class CollectionPage extends StatefulWidget {
  @override
  _CollectionPageState createState() => _CollectionPageState();
}

class _CollectionPageState extends State<CollectionPage> {
  final List<CollectionItemModel> items = [];
  static const platform = MethodChannel('com.example.collect/share');

  @override
  void initState() {
    super.initState();
    _setupMethodChannel();
  }

  void _setupMethodChannel() {
    platform.setMethodCallHandler((call) async {
      switch (call.method) {
        case 'onTextReceived':
          _addTextItem(call.arguments as String);
          break;
        case 'onFileReceived':
          _addFileItem(call.arguments as String);
          break;
      }
    });
  }

  void _addTextItem(String text) {
    setState(() {
      items.add(CollectionItemModel(
        title: '文本分享 ${DateTime.now().toString().substring(0, 10)}',
        content: text,
        description: '来自系统分享的文本内容',
        type: ContentType.text,
        createTime: DateTime.now(),
        source: '系统分享',
      ));
    });
  }

  void _addFileItem(String filePath) {
    setState(() {
      items.add(CollectionItemModel(
        title: '文件分享 ${DateTime.now().toString().substring(0, 10)}',
        content: filePath,
        description: '来自系统分享的文件',
        type: ContentType.file,
        createTime: DateTime.now(),
        source: '系统分享',
      ));
    });
  }

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
