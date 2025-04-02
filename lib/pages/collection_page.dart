import 'package:flutter/material.dart';
import 'package:collect/widgets/collection_item.dart';
import 'package:collect/models/shared_item.dart'; // 现在包含 CollectionDatabase
import 'package:collect/models/item.dart';      // 导入 CollectionItemModel
import 'package:collect/services/share_handler.dart';
import 'package:collect/pages/settings_page.dart';
import 'package:collect/pages/search_page.dart';
import 'package:collect/utils/storage_utils.dart'; // 导入 StorageUtils
import 'package:file_picker/file_picker.dart';
import 'package:share_plus/share_plus.dart'; // 导入 share_plus
import 'dart:io'; // 导入 dart:io 以使用 File
import 'package:path/path.dart' as p; // 导入 path
import 'package:flutter/foundation.dart'; // for kDebugMode

class CollectionPage extends StatefulWidget {
  const CollectionPage({super.key}); // 使用 super(key: key)

  @override
  State<CollectionPage> createState() => _CollectionPageState();
}

class _CollectionPageState extends State<CollectionPage> {
  // 使用 CollectionItemModel
  final List<CollectionItemModel> _items = [];
  final ShareHandler _shareHandler = ShareHandler();
  // 使用 CollectionDatabase
  late final CollectionDatabase _database;
  int _lastItemCount = 0;
  String _currentTag = 'test'; // TODO: 实现文件夹/标签切换逻辑

  @override
  void initState() {
    super.initState();
    _initialize(); // 调用新的初始化方法
  }

  // 将初始化逻辑移到单独的 async 方法中
  Future<void> _initialize() async {
    // 首先请求权限
    // 不再在此处强制请求，让 getPublicAppDirectory 处理按需请求
    // await StorageUtils.requestStoragePermission();

    // 初始化 CollectionDatabase
    _database = CollectionDatabase();
    await _loadItems(); // 初始加载 (await确保加载完成后再继续)

    // 设置分享处理回调
    _shareHandler.handleSharedContent((itemData) => _handleIncomingShare(itemData));

    // 监听数据库变化 (使用 CollectionItemModel)
    _database.watchItems().listen((items) {
      if (mounted) { // 检查 widget 是否还在树中
         if (items.length > _lastItemCount) {
           _showSuccessSnackBar('收藏成功');
         }
         _lastItemCount = items.length;
         setState(() {
           _items.clear();
           // TODO: 根据 _currentTag 过滤项目
           _items.addAll(items.where((item) => item.tag == _currentTag));
         });
      }
    }, onError: (error) {
       print("Error listening to database changes: $error");
       if (mounted) {
         _showErrorSnackBar("加载数据时出错");
       }
    });
  }


  // 处理来自 ShareHandler 的回调
  Future<void> _handleIncomingShare(Map<String, dynamic> itemData) async {
     // 注意：这里的 itemData['content'] 已经是 ShareHandler 处理过的、
     // 保存到公共目录（如果成功）的路径
     try {
       final newItem = CollectionItemModel(
         title: itemData['title'] ?? '分享的内容',
         content: itemData['content'] ?? '', // 直接使用 ShareHandler 提供的路径
         description: itemData['description'] ?? '',
         type: _getContentTypeFromString(itemData['type'] ?? 'text'),
         createTime: DateTime.now(),
         tag: _currentTag, // 使用当前标签
       );
       // 检查 content 是否为空，因为 ShareHandler 可能无法保存文件
       if (newItem.content.isEmpty && (newItem.type == ContentType.image || newItem.type == ContentType.video || newItem.type == ContentType.file)) {
          _showErrorSnackBar("处理分享文件失败，无法保存");
          return;
       }
       await _database.insertItem(newItem);
     } catch (e) {
       print("Error handling incoming share: $e");
       _showErrorSnackBar("处理分享内容失败");
     }
  }


  void _showSuccessSnackBar(String message) {
    if (!mounted) return; // 检查 mounted 状态
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        duration: const Duration(seconds: 2),
      ),
    );
  }

   void _showErrorSnackBar(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.redAccent,
        duration: const Duration(seconds: 3),
      ),
    );
  }


  Future<void> _loadItems() async {
    try {
      // 使用 CollectionDatabase
      final items = await _database.getItemsByTag(_currentTag); // 按标签加载
      if (mounted) {
        setState(() {
          _items.clear();
          _items.addAll(items);
          _lastItemCount = items.length; // 更新计数器
        });
      }
    } catch (e) {
       print("Error loading items: $e");
       _showErrorSnackBar("加载收藏失败");
    }
  }

  // 添加文本项目 (使用 CollectionItemModel)
  Future<void> _addTextItem() async {
    final TextEditingController textController = TextEditingController();
    final TextEditingController titleController = TextEditingController();

    final result = await showDialog<Map<String, String>>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('添加文本收藏'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
             TextField(
              controller: titleController,
              autofocus: true,
              decoration: const InputDecoration(hintText: '标题 (可选)'),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: textController,
              decoration: const InputDecoration(hintText: '输入要收藏的文本'),
              maxLines: 5, // 允许多行输入
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context, {
                'title': titleController.text,
                'content': textController.text
              });
            },
            child: const Text('确定'),
          ),
        ],
      ),
    );

    if (result != null && result['content']!.isNotEmpty) {
      final title = result['title']!.isNotEmpty ? result['title']! : '文本收藏';
      final content = result['content']!;
      await _database.insertItem(CollectionItemModel(
        title: title,
        type: ContentType.text,
        content: content,
        description: content.substring(0, (content.length > 50 ? 50 : content.length)), // 简单描述
        createTime: DateTime.now(),
        tag: _currentTag, // 使用当前标签
      ));
    }
  }

  // 添加文件项目 (使用 CollectionItemModel) - 修改为保存到公共目录
  Future<void> _addFileItem() async {
    try {
      // 1. 获取公共目录路径
      final String? publicDirPath = await StorageUtils.getPublicAppDirectory();
      if (publicDirPath == null) {
        _showErrorSnackBar("无法访问存储目录，请检查权限");
        return;
      }

      // 2. 选择文件
      final result = await FilePicker.platform.pickFiles();
      if (result != null) {
        final file = result.files.single;
        if (file.path != null) {
          final originalPath = file.path!;
          final fileName = file.name; // 使用原始文件名
          final contentType = _getFileType(originalPath);

          // 3. 构建目标路径
          final destinationPath = p.join(publicDirPath, fileName);

          // 4. 检查目标文件是否已存在 (可选，避免覆盖)
          if (await File(destinationPath).exists()) {
             // 可以提示用户文件已存在，或自动重命名
             // 简单处理：显示错误
             _showErrorSnackBar("文件 '$fileName' 已存在于收藏目录");
             return;
             // // 自动重命名示例:
             // String uniqueFileName = await _findUniqueFileName(publicDirPath, fileName);
             // destinationPath = p.join(publicDirPath, uniqueFileName);
          }


          try {
             // 5. 复制文件到公共目录
             if (kDebugMode) {
               print("Copying file from $originalPath to $destinationPath");
             }
             await File(originalPath).copy(destinationPath);

             // 6. 保存新路径到数据库
             await _database.insertItem(CollectionItemModel(
               title: fileName, // 使用原始文件名作为标题
               type: contentType,
               content: destinationPath, // 存储复制后的路径
               description: fileName, // 使用文件名作为描述
               createTime: DateTime.now(),
               tag: _currentTag, // 使用当前标签
             ));
             // 成功提示由数据库监听器处理
          } catch (copyError) {
             print("Error copying file to public directory: $copyError");
             _showErrorSnackBar("保存文件失败");
          }

        } else {
           _showErrorSnackBar("无法获取文件路径");
        }
      }
    } on Exception catch (e) {
       print("Error picking file: $e");
       _showErrorSnackBar("选择文件失败");
    }
  }

  // // 辅助函数：查找唯一文件名 (如果需要)
  // Future<String> _findUniqueFileName(String dirPath, String originalName) async {
  //   String baseName = p.basenameWithoutExtension(originalName);
  //   String extension = p.extension(originalName);
  //   String testName = originalName;
  //   int counter = 1;
  //   while (await File(p.join(dirPath, testName)).exists()) {
  //     testName = '${baseName}_$counter$extension';
  //     counter++;
  //   }
  //   return testName;
  // }


  // 根据文件路径判断 ContentType
  ContentType _getFileType(String path) {
    final ext = p.extension(path).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].contains(ext)) {
      return ContentType.image;
    } else if (['.mp4', '.mov', '.avi', '.wmv', '.mkv'].contains(ext)) {
      return ContentType.video;
    } else {
      return ContentType.file;
    }
  }

  // 从字符串获取 ContentType (用于处理分享)
  ContentType _getContentTypeFromString(String typeString) {
     switch (typeString.toLowerCase()) {
       case 'text': return ContentType.text;
       case 'url': return ContentType.url;
       case 'image': return ContentType.image;
       case 'video': return ContentType.video;
       case 'file': return ContentType.file;
       default: return ContentType.text; // 默认为文本
     }
  }


  // 分享项目
  Future<void> _shareItem(CollectionItemModel item) async {
    try {
      if (item.type == ContentType.image || item.type == ContentType.video || item.type == ContentType.file) {
        // 分享文件 - 使用 content (现在是公共路径)
        final file = File(item.content);
        if (await file.exists()) {
          await Share.shareXFiles([XFile(item.content)], text: item.title);
        } else {
          _showErrorSnackBar("文件不存在，无法分享");
          print("File not found for sharing: ${item.content}");
        }
      } else {
        // 分享文本或 URL
        await Share.share('${item.title}\n${item.content}');
      }
    } catch (e) {
      print("Error sharing item: $e");
      _showErrorSnackBar("分享失败");
    }
  }

  // 删除项目 - 修改为同时删除文件
  Future<void> _deleteItem(CollectionItemModel item) async {
    if (item.id == null) {
       _showErrorSnackBar("无法删除：项目 ID 不存在");
       return;
    }

    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('确认删除'),
        content: Text('确定要删除 "${item.title}" 吗？\n注意：对应的文件也会从存储中删除。'), // 提示会删除文件
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('删除', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      String? filePathToDelete; // 记录文件路径以便删除
      if (item.type == ContentType.image || item.type == ContentType.video || item.type == ContentType.file) {
         filePathToDelete = item.content;
      }

      try {
        // 1. 从数据库删除记录
        await _database.deleteItem(item.id!);

        // 2. 如果是文件类型，尝试删除文件
        if (filePathToDelete != null) {
          try {
            final file = File(filePathToDelete);
            if (await file.exists()) {
              await file.delete();
              if (kDebugMode) {
                print("Deleted file: $filePathToDelete");
              }
            } else {
               if (kDebugMode) {
                 print("File to delete not found: $filePathToDelete");
               }
            }
          } catch (fileError) {
             print("Error deleting file $filePathToDelete: $fileError");
             // 可以选择是否通知用户文件删除失败
             _showErrorSnackBar("数据库记录已删除，但文件删除失败");
          }
        }

        _showSuccessSnackBar('删除成功');
        // 列表会在数据库监听器中自动更新
      } catch (dbError) {
         print("Error deleting item from database: $dbError");
         _showErrorSnackBar("删除数据库记录失败");
      }
    }
  }


  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('收藏空间 - $_currentTag'), // 显示当前标签
        actions: [
          // IconButton(
          //   icon: const Icon(Icons.search),
          //   onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SearchPage())), // 添加 const
          // ),
          // // TODO: 添加切换文件夹/标签的按钮
          // IconButton(
          //   icon: const Icon(Icons.folder_open),
          //   tooltip: "切换文件夹",
          //   onPressed: () {
          //     // TODO: 实现切换文件夹逻辑
          //      _showErrorSnackBar("切换文件夹功能待实现");
          //   },
          // ),
          // IconButton(
          //   icon: const Icon(Icons.settings),
          //   onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsPage())), // 添加 const
          // ),
        ],
      ),
      body: _items.isEmpty
          ? const Center(child: Text("这个文件夹是空的", style: TextStyle(color: Colors.grey)))
          : GridView.builder(
              padding: const EdgeInsets.all(8),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2, // 每行显示两个
                childAspectRatio: 1.0, // 调整宽高比为 1:1
                crossAxisSpacing: 8,
                mainAxisSpacing: 8,
              ),
              itemCount: _items.length,
              // 使用 CollectionItemModel 并传递回调
              itemBuilder: (context, index) {
                 final item = _items[index];
                 return CollectionItem(
                   key: ValueKey(item.id), // 使用 ID 作为 Key
                   item: item,
                   onShare: () => _shareItem(item),
                   onDelete: () => _deleteItem(item),
                 );
              }
            ),
      floatingActionButton: FloatingActionButton(
        child: const Icon(Icons.add),
        onPressed: () => showModalBottomSheet(
          context: context,
          builder: (context) => Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.text_fields),
                title: const Text('添加文本'),
                onTap: () {
                  Navigator.pop(context);
                  _addTextItem();
                },
              ),
              ListTile(
                leading: const Icon(Icons.link),
                title: const Text('添加链接 (待实现)'), // TODO
                onTap: () {
                   Navigator.pop(context);
                   _showErrorSnackBar("添加链接功能待实现");
                  // _addUrlItem();
                },
              ),
              ListTile(
                leading: const Icon(Icons.insert_drive_file),
                title: const Text('添加文件/图片/视频'),
                onTap: () {
                  Navigator.pop(context);
                  _addFileItem();
                },
              ),
               ListTile(
                leading: const Icon(Icons.create_new_folder_outlined),
                title: const Text('创建新文件夹 (待实现)'), // TODO
                onTap: () {
                   Navigator.pop(context);
                   _showErrorSnackBar("创建文件夹功能待实现");
                  // _createNewFolder();
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
    // 注意：由于 _initialize 是 async 的，需要确保 _database 在 dispose 时已初始化
    // 一个简单的处理是让 _database 可空，并在使用前检查
    // 或者确保 _initialize 在 dispose 前完成（通常是这样）
    _database.close(); // 关闭数据库连接
    super.dispose();
  }
}
