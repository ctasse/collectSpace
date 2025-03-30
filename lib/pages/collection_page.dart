import 'package:flutter/material.dart';
import 'package:collect/widgets/collection_item.dart';
import 'package:collect/models/shared_item.dart';
import 'package:collect/services/share_handler.dart';
import 'package:collect/pages/settings_page.dart';
import 'package:collect/pages/search_page.dart';
import 'package:file_picker/file_picker.dart';

class CollectionPage extends StatefulWidget {
  @override
  _CollectionPageState createState() => _CollectionPageState();
}

class _CollectionPageState extends State<CollectionPage> {
  final List<SharedItem> _items = [];
  final ShareHandler _shareHandler = ShareHandler();
  late final SharedItemDatabase _database;
  int _lastItemCount = 0;

  @override
  void initState() {
    super.initState();
    _database = SharedItemDatabase();
    _loadItems();
    _shareHandler.handleSharedContent();
    
    // 监听数据库变化
    _database.watchItems().listen((items) {
      if (items.length > _lastItemCount) {
        _showSuccessSnackBar('收藏成功');
      }
      _lastItemCount = items.length;
      setState(() {
        _items.clear();
        _items.addAll(items);
      });
    });
  }

  void _showSuccessSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        duration: Duration(seconds: 2),
      ),
    );
  }

  Future<void> _loadItems() async {
    final items = await _database.getAllItems();
    setState(() {
      _items.addAll(items);
      _lastItemCount = items.length;
    });
  }

  Future<void> _addTextItem() async {
    final TextEditingController textController = TextEditingController();

    final text = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('添加文本'),
        content: TextField(
          controller: textController, // 提供控制器
          autofocus: true,
          decoration: InputDecoration(hintText: '输入要收藏的文本'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('取消'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context, textController.text); // 使用控制器获取文本
            },
            child: Text('确定'),
          ),
        ],
      ),
    );

    if (text != null && text.isNotEmpty) {
      await _database.insertItem(SharedItem(
        title: '文本收藏',
        type: 'text',
        content: text,
        createdAt: DateTime.now(),
      ));
    }
  }

  Future<void> _addFileItem() async {
    final result = await FilePicker.platform.pickFiles();
    if (result != null) {
      final file = result.files.single;
      await _database.insertItem(SharedItem(
        title: file.name,
        type: _getFileType(file.path!),
        content: file.path!,
        createdAt: DateTime.now(),
      ));
    }
  }

  String _getFileType(String path) {
    final ext = path.split('.').last.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif'].contains(ext)) {
      return 'image';
    }
    return 'file';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('收藏空间'),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => SearchPage())),
          ),
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => SettingsPage())),
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
        itemCount: _items.length,
        itemBuilder: (context, index) => CollectionItem(item: _items[index]),
      ),
      floatingActionButton: FloatingActionButton(
        child: Icon(Icons.add),
        onPressed: () => showModalBottomSheet(
          context: context,
          builder: (context) => Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: Icon(Icons.text_fields),
                title: Text('添加文本'),
                onTap: () {
                  Navigator.pop(context);
                  _addTextItem();
                },
              ),
              ListTile(
                leading: Icon(Icons.insert_drive_file),
                title: Text('添加文件'),
                onTap: () {
                  Navigator.pop(context);
                  _addFileItem();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _database.close();
    super.dispose();
  }
}
