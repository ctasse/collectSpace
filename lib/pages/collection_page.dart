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
import 'package:collect/pages/preview/image_preview_page.dart'; // 导入图片预览页面
import 'package:collect/pages/preview/video_preview_page.dart'; // 导入视频预览页面
import 'package:url_launcher/url_launcher.dart'; // 用于打开链接
import 'package:dynamic_color/dynamic_color.dart'; // 导入 dynamic_color
import 'package:material_color_utilities/material_color_utilities.dart'; // 导入 material_color_utilities

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
  // _currentTag 为 null 表示显示 "全部"
  String? _currentTag = null; // 初始显示全部
  List<String> _tags = []; // 存储所有标签
  bool _isSelecting = false; // 是否处于多选模式
  final Set<int> _selectedItemIds = {}; // 存储选中的项目 ID

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
    await _loadTags(); // 先加载标签
    await _loadItems(); // 再根据初始标签（全部）加载项目

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
           // 根据 _currentTag 过滤项目，如果 _currentTag 为 null 则显示全部
           if (_currentTag == null) {
             _items.addAll(items);
           } else {
             _items.addAll(items.where((item) => item.tag == _currentTag));
           }
           // 可以在这里也更新标签列表，以防后台添加了新标签
           _loadTags();
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
         // 如果当前是 "全部"，则新项目默认放入 "未分类"
         tag: _currentTag ?? '未分类',
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


  // 加载标签列表
  Future<void> _loadTags() async {
    try {
      final tags = await _database.getAllTags();
      if (mounted) {
        setState(() {
          _tags = tags;
        });
      }
    } catch (e) {
      print("Error loading tags: $e");
      _showErrorSnackBar("加载标签列表失败");
    }
  }

  // 加载项目，根据 _currentTag 决定加载全部还是特定标签
  Future<void> _loadItems() async {
    try {
      List<CollectionItemModel> items;
      if (_currentTag == null) {
        // 加载所有项目
        items = await _database.getAllItems();
      } else {
        // 加载特定标签的项目
        items = await _database.getItemsByTag(_currentTag!);
      }

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
        // 如果当前是 "全部"，则新项目默认放入 "未分类"
        tag: _currentTag ?? '未分类',
      ));
    }
  }

  // 添加文件项目 (使用 CollectionItemModel) - 修改为保存到公共目录
  Future<void> _addFileItem() async {
    try {
      // 1. 获取公共目录路径
      // 1. 获取公共目录下的 shared_imports 子目录路径
      //    复用 ShareHandler 获取路径的逻辑可能更好，但这里直接实现
      final String? publicBaseDirPath = await StorageUtils.getPublicAppDirectory();
      if (publicBaseDirPath == null) {
        _showErrorSnackBar("无法访问存储目录，请检查权限");
        return;
      }
      final String targetDirPath = p.join(publicBaseDirPath, 'shared_imports');
      final targetDir = Directory(targetDirPath);
      try {
         if (!await targetDir.exists()) {
            await targetDir.create(recursive: true);
         }
      } catch (e) {
         print("Error creating target directory $targetDirPath: $e");
         _showErrorSnackBar("无法创建目标存储子目录");
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
          // 3. 构建目标路径 (在 shared_imports 子目录下)
          final destinationPath = p.join(targetDirPath, fileName);

          // 4. 检查目标文件是否已存在 (可选，避免覆盖)
          if (await File(destinationPath).exists()) {
             // 可以提示用户文件已存在，或自动重命名
             // 简单处理：显示错误
             _showErrorSnackBar("文件 '$fileName' 已存在于收藏目录");
             return;
             // // 自动重命名示例 (使用 StorageUtils):
             // String uniqueFileName = await StorageUtils.findUniqueFileName(targetDirPath, fileName);
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
               // 如果当前是 "全部"，则新项目默认放入 "未分类"
               tag: _currentTag ?? '未分类',
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
      appBar: _buildAppBar(), // 使用单独的方法构建 AppBar
      // 添加 Drawer
      drawer: FutureBuilder<ColorScheme>(
        future: DynamicColorPlugin.getCorePalette().then((palette) {
          final primaryColor = palette?.primary.get(40) ?? Colors.blue.value;
          return ColorScheme.fromSeed(seedColor: Color(primaryColor));
        }),
        builder: (context, snapshot) {
          final colorScheme = snapshot.data ?? Theme.of(context).colorScheme;
          return Drawer(
            child: ListView(
              padding: EdgeInsets.zero,
              children: [
                DrawerHeader(
                  decoration: BoxDecoration(
                    color: colorScheme.primary, // 使用动态生成的主色
                  ),
                  child: Text(
                    '标签',
                    style: TextStyle(
                      color: colorScheme.onPrimary, // 动态生成的对比色
                      fontSize: 24,
                    ),
                  ),
                ),
                ListTile(
                  leading: Icon(Icons.inbox, color: _currentTag == null ? colorScheme.primary : null),
                  title: Text(
                    '全部',
                    style: TextStyle(
                      fontWeight: _currentTag == null ? FontWeight.bold : FontWeight.normal,
                    ),
                  ),
                  onTap: () {
                    Navigator.pop(context); // 关闭 drawer
                    if (_currentTag != null) { // 只有在当前不是“全部”时才切换
                      setState(() {
                        _currentTag = null;
                      });
                      _loadItems(); // 重新加载所有项目
                    }
                  },
                ),
                const Divider(),
                // 动态生成标签列表
                ..._tags.map((tag) => ListTile(
                      leading: Icon(Icons.folder_outlined, color: _currentTag == tag ? colorScheme.primary : null),
                      title: Text(
                        tag,
                        style: TextStyle(
                          fontWeight: _currentTag == tag ? FontWeight.bold : FontWeight.normal,
                        ),
                      ),
                      onTap: () {
                        Navigator.pop(context); // 关闭 drawer
                        if (_currentTag != tag) { // 只有在点击不同标签时才切换
                          setState(() {
                            _currentTag = tag;
                          });
                          _loadItems(); // 重新加载该标签的项目
                        }
                      },
                    )).toList(),
              ],
            ),
          );
        },
      ),
      body: _items.isEmpty
          ? Center(child: Text(_currentTag == null ? "还没有任何收藏" : "这个标签是空的", style: TextStyle(color: Colors.grey)))
          :
           GridView.builder(
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
                final isSelected = _selectedItemIds.contains(item.id);

                return CollectionItem(
                  key: ValueKey(item.id),
                  item: item,
                  isSelecting: _isSelecting,
                  isSelected: isSelected,
                  onShare: () => _shareItem(item),
                  onDelete: () => _deleteItem(item),
                  onChangeTag: () {
                    if (item.id != null) {
                      _showChangeTagDialog([item.id!]);
                    }
                  },
                 onRename: () => _showRenameDialog(item), // 添加 onRename 回调
                  // 添加新的回调
                  onTap: () {
                    if (_isSelecting) {
                      if (item.id != null) {
                        _toggleSelection(item.id!);
                      }
                    } else {
                      // 正常点击预览逻辑
                      _handleItemTap(item);
                    }
                  },
                  onLongPress: () {
                    if (item.id != null) {
                      _enterSelectionMode(item.id!);
                    }
                  },
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
                leading: const Icon(Icons.bookmark),
                title: const Text('创建标签'),
                onTap: () {
                   Navigator.pop(context); // 关闭 bottom sheet
                   _createNewFolder(); // 调用创建标签方法
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  // 构建 AppBar
  AppBar _buildAppBar() {
    if (_isSelecting) {
      // 选择模式下的 AppBar
      return AppBar(
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: _exitSelectionMode, // 取消选择
          tooltip: '取消选择',
        ),
        title: Text('已选择 ${_selectedItemIds.length} 项'),
        actions: [
          IconButton(
            icon: const Icon(Icons.low_priority), // 使用一个合适的图标表示移动/改标签
            onPressed: _selectedItemIds.isEmpty
                ? null // 没有选中项时禁用
                : () => _showChangeTagDialog(_selectedItemIds.toList()),
            tooltip: '修改标签',
          ),
          // 可以添加其他批量操作，如批量删除
          // IconButton(
          //   icon: const Icon(Icons.delete_outline),
          //   onPressed: _selectedItemIds.isEmpty ? null : _deleteSelectedItems,
          //   tooltip: '删除选中项',
          // ),
        ],
      );
    } else {
      // 正常模式下的 AppBar
      return AppBar(
        title: Text(_currentTag == null ? '收藏 - 全部' : '收藏 - $_currentTag'),
        // leading: Builder( // 如果需要一直显示菜单按钮
        //   builder: (context) => IconButton(
        //     icon: const Icon(Icons.menu),
        //     onPressed: () => Scaffold.of(context).openDrawer(),
        //     tooltip: MaterialLocalizations.of(context).openAppDrawerTooltip,
        //   ),
        // ),
        actions: [
          // 可以保留其他按钮，如设置
          // IconButton(
          //   icon: const Icon(Icons.settings),
          //   onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsPage())),
          // ),
        ],
      );
    }
  }

  // 进入选择模式
  void _enterSelectionMode(int itemId) {
    if (!_isSelecting) {
      setState(() {
        _isSelecting = true;
        _selectedItemIds.add(itemId);
      });
    }
  }

  // 切换项目选中状态
  void _toggleSelection(int itemId) {
    if (!_isSelecting) return; // 非选择模式下无效
    setState(() {
      if (_selectedItemIds.contains(itemId)) {
        _selectedItemIds.remove(itemId);
        if (_selectedItemIds.isEmpty) {
          _isSelecting = false; // 如果没有选中项了，退出选择模式
        }
      } else {
        _selectedItemIds.add(itemId);
      }
    });
  }

  // 退出选择模式
  void _exitSelectionMode() {
    setState(() {
      _isSelecting = false;
      _selectedItemIds.clear();
    });
  }

  // 显示修改标签对话框
  Future<void> _showChangeTagDialog(List<int> itemIds) async {
     if (itemIds.isEmpty) return; // 没有选中项则不显示

     // 确保标签列表是最新的
     await _loadTags();

     final String? selectedTag = await showDialog<String>(
        context: context,
        builder: (context) {
          String? newTagInput; // 用于存储新标签输入
          final TextEditingController newTagController = TextEditingController();

          return AlertDialog(
            title: Text('为 ${itemIds.length} 个项目选择标签'),
            content: StatefulBuilder( // 使用 StatefulBuilder 局部刷新对话框内容
              builder: (BuildContext context, StateSetter setStateDialog) {
                return SingleChildScrollView( // 允许滚动，以防标签过多
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // 显示现有标签
                      ..._tags.map((tag) => RadioListTile<String>(
                        title: Text(tag),
                        value: tag,
                        groupValue: null, // 这里不直接用 groupValue，点击时直接 pop
                        onChanged: (value) {
                          Navigator.pop(context, value); // 选择现有标签
                        },
                      )).toList(),
                      const Divider(),
                      // 创建新标签选项
                      ListTile(
                        title: TextField(
                          controller: newTagController,
                          decoration: const InputDecoration(hintText: '或创建新标签'),
                          onChanged: (value) => newTagInput = value.trim(),
                        ),
                        trailing: IconButton(
                          icon: const Icon(Icons.check),
                          onPressed: () {
                            if (newTagInput != null && newTagInput!.isNotEmpty) {
                              if (_tags.contains(newTagInput)) {
                                 _showErrorSnackBar("标签 '$newTagInput' 已存在");
                              } else {
                                 Navigator.pop(context, newTagInput); // 返回新标签名
                              }
                            } else {
                               _showErrorSnackBar("标签名称不能为空");
                            }
                          },
                        ),
                      ),
                    ],
                  ),
                );
              }
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('取消'),
              ),
            ],
          );
        },
     );

     if (selectedTag != null && selectedTag.isNotEmpty) {
        await _changeItemsTag(itemIds, selectedTag);
     }
  }

  // 批量修改项目标签
  Future<void> _changeItemsTag(List<int> itemIds, String newTag) async {
    if (itemIds.isEmpty) return;

    try {
      // 调用 CollectionDatabase 中的批量更新方法
      await _database.batchUpdateItemTags(itemIds, newTag);

      // 数据库方法会自动触发流更新，但我们仍需手动刷新标签列表和当前视图
      // （因为数据库流更新的是 getAllItems，可能不完全符合当前视图）
      await _loadTags(); // 更新标签列表（如果创建了新标签）
      await _loadItems(); // 重新加载当前视图的项目

      _showSuccessSnackBar('${itemIds.length} 个项目的标签已修改为 "$newTag"');
    } catch (e) {
      print("Error changing tags: $e");
      _showErrorSnackBar("修改标签失败");
    } finally {
      _exitSelectionMode(); // 无论成功失败，都退出选择模式
    }
  }


  // 创建新标签（添加新标签）
  Future<void> _createNewFolder() async {
    final TextEditingController folderNameController = TextEditingController();
    final newTagName = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('创建新标签'),
        content: TextField(
          controller: folderNameController,
          autofocus: true,
          decoration: const InputDecoration(hintText: '输入标签名称'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () {
              final name = folderNameController.text.trim();
              if (name.isNotEmpty) {
                 // 检查标签是否已存在 (可选，但建议)
                 if (_tags.contains(name)) {
                    _showErrorSnackBar("标签 '$name' 已存在");
                 } else {
                    Navigator.pop(context, name);
                 }
              } else {
                 _showErrorSnackBar("标签名称不能为空");
              }
            },
            child: const Text('创建'),
          ),
        ],
      ),
    );

    if (newTagName != null && newTagName.isNotEmpty) {
      // 重新加载标签列表以包含新标签（即使它还没有项目）
      // 或者，如果希望只显示有项目的标签，则不需要在这里做任何事
      // 为了让用户能立即看到并切换到新标签，我们重新加载标签并切换过去
      await _loadTags(); // 重新获取标签列表
      // 切换到新创建的标签
      setState(() {
        _currentTag = newTagName;
      });
      await _loadItems(); // 加载新标签下的项目（应该是空的）
      _showSuccessSnackBar("标签 '$newTagName' 创建成功");
    }
  }

  void _handleItemTap(CollectionItemModel item) {
  switch (item.type) {
    case ContentType.image:
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => ImagePreviewPage(
            imagePath: item.content,
            title: item.title,
          ),
        ),
      );
      break;
    case ContentType.video:
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => VideoPreviewPage(
            videoPath: item.content,
            title: item.title,
          ),
        ),
      );
      break;
    case ContentType.text:
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(item.title.isNotEmpty ? item.title : "文本预览"),
          content: SingleChildScrollView(
            child: Text(
              item.content,
              style: const TextStyle(fontSize: 14, color: Colors.black87),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text("关闭"),
            ),
          ],
        ),
      );
      break;
    case ContentType.url:
      final Uri url = Uri.parse(item.content);
      if (url.scheme == 'http' || url.scheme == 'https') {
        launchUrl(url, mode: LaunchMode.externalApplication).catchError((e) {
          if (kDebugMode) print("Error opening URL: $e");
        });
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("无效的链接格式")),
        );
      }
      break;
    case ContentType.file:
      if (item.content.isNotEmpty) {
        _shareItem(item);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("文件路径无效，无法分享")),
        );
      }
      break;
    default:
      if (kDebugMode) print("Tapped on unknown type item");
  }
}

// 显示重命名对话框 (限制后缀名修改)
Future<void> _showRenameDialog(CollectionItemModel item) async {
  String initialBaseName = item.title;
  String originalExtension = '';
  bool isFileItem = item.type == ContentType.image || item.type == ContentType.video || item.type == ContentType.file;

  if (isFileItem && item.content.isNotEmpty) {
    // 如果是文件类型，尝试从 content (路径) 中提取基础名称和扩展名
    // 因为 title 可能不总是包含扩展名，或者可能与实际文件名不一致
    try {
       originalExtension = p.extension(item.content); // 获取原始扩展名
       initialBaseName = p.basenameWithoutExtension(item.content); // 获取不含扩展名的基础名称
    } catch (e) {
       print("Error extracting base name/extension from content: ${item.content} - $e");
       // 如果从 content 提取失败，回退到使用 title (可能不准确)
       if (item.title.contains('.')) {
          originalExtension = p.extension(item.title);
          initialBaseName = p.basenameWithoutExtension(item.title);
       } else {
          initialBaseName = item.title; // 没有扩展名
          originalExtension = '';
       }
    }
  } else if (isFileItem) {
      // 文件类型但 content 为空，可能只发生在异常情况，尝试从 title 提取
      if (item.title.contains('.')) {
          originalExtension = p.extension(item.title);
          initialBaseName = p.basenameWithoutExtension(item.title);
       } else {
          initialBaseName = item.title;
          originalExtension = '';
       }
  }
  // 对于非文件类型，initialBaseName 就是 item.title，originalExtension 为空

  final TextEditingController renameController = TextEditingController(text: initialBaseName);
  final newName = await showDialog<String>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('重命名'),
      content: TextField(
        controller: renameController,
        autofocus: true,
        decoration: const InputDecoration(hintText: '输入新名称'),
        // 考虑添加输入验证，例如不允许空名称或特殊字符
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('取消'),
        ),
        TextButton(
          onPressed: () {
            final newBaseName = renameController.text.trim();
            // 检查新基础名称是否为空
            if (newBaseName.isEmpty) {
               _showErrorSnackBar("名称不能为空");
               return; // 阻止关闭对话框
            }

            // 组合回完整的新名称 (如果需要)
            final finalNewName = isFileItem ? '$newBaseName$originalExtension' : newBaseName;

            // 检查名称是否真的改变了 (与原始 title 比较)
            if (finalNewName != item.title) {
               Navigator.pop(context, finalNewName); // 返回组合后的完整名称
            } else {
               // 名称未改变，直接关闭对话框
               Navigator.pop(context);
            }
          },
          child: const Text('确定'),
        ),
      ],
    ),
  );

  if (newName != null && newName.isNotEmpty) {
    await _renameItem(item, newName);
  }
}

// 处理重命名逻辑
Future<void> _renameItem(CollectionItemModel item, String newName) async {
  if (item.id == null) {
    _showErrorSnackBar("无法重命名：项目 ID 不存在");
    return;
  }

  String? oldFilePath;
  String? newFilePath;
  bool isFileItem = item.type == ContentType.image || item.type == ContentType.video || item.type == ContentType.file;

  if (isFileItem) {
    oldFilePath = item.content;
    try {
      // 检查旧文件是否存在
      final oldFile = File(oldFilePath);
      if (!await oldFile.exists()) {
         _showErrorSnackBar("无法重命名文件：源文件不存在 ($oldFilePath)");
         // 即使文件不存在，也可能需要更新数据库中的标题，根据需求决定
         // return;
      }

      // 构建新文件路径
      final dirPath = p.dirname(oldFilePath);
      // newName 已经包含了正确的扩展名 (由 _showRenameDialog 组合好)
      // 直接使用 newName 作为新的文件名
      final newFileName = newName;
      newFilePath = p.join(dirPath, newFileName);

      // 检查新文件名是否已存在 (非常重要)
      if (await File(newFilePath).exists()) {
         _showErrorSnackBar("无法重命名：目标文件名 '$newFileName' 已存在");
         return; // 阻止重命名
      }
    } catch (e) {
       print("Error preparing file rename: $e");
       _showErrorSnackBar("准备文件重命名时出错");
       return;
    }
  }

  try {
    // 1. (如果是文件) 尝试重命名物理文件
    if (isFileItem && oldFilePath != null && newFilePath != null) {
      if (kDebugMode) {
        print("Renaming file from $oldFilePath to $newFilePath");
      }
      await File(oldFilePath).rename(newFilePath);
    }

    // 2. 更新数据库记录 (标题和 content - 如果是文件)
    String contentToUpdate = item.content; // 默认使用原始 content
    if (isFileItem) {
      if (newFilePath != null) {
        contentToUpdate = newFilePath; // 如果是文件且新路径有效，则使用新路径
      } else {
        // 如果是文件项，但 newFilePath 为 null (理论上不应发生在此处，因为前面有检查)
        // 保持 content 不变或记录错误
        print("Error: newFilePath is null when updating database for file item ID: ${item.id}");
        // contentToUpdate = item.content; // 保持不变
      }
    }

    await _database.updateItemTitleAndContent(
      item.id!,
      newName,
      contentToUpdate // 传递确保非空的 content
    );

    _showSuccessSnackBar('重命名成功');
    // 列表会在数据库监听器中自动更新，或者手动调用 _loadItems() 强制刷新
    // await _loadItems(); // 如果监听器更新不及时或有特殊过滤逻辑，可以取消注释

  } on FileSystemException catch (e) {
     print("Error renaming file system entry: $e");
     _showErrorSnackBar("重命名文件失败: ${e.message}");
     // 文件重命名失败，数据库记录未更新
  } catch (e) {
     print("Error renaming item: $e");
     _showErrorSnackBar("重命名失败");
     // 其他错误，可能文件已重命名但数据库更新失败
     // TODO: 考虑回滚文件重命名操作？ (复杂)
  }
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
