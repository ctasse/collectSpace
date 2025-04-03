import 'package:sqflite/sqflite.dart';
import 'dart:async';
import 'package:path/path.dart'; // 需要导入 path
import 'package:collect/models/item.dart'; // 导入 CollectionItemModel

// // SharedItem 类不再直接用于数据库交互，使用 CollectionItemModel 代替
// class SharedItem {
//   // ... (原有代码注释掉或移除)
// }

class CollectionDatabase { // 重命名类
  static const _dbName = 'collection_items.db'; // 可以改名以示区别
  static const _dbVersion = 1; // 如果结构变化，应增加版本号
  static const _tableName = 'collection_items'; // 表名

  Database? _database;
  // 流的类型改为 CollectionItemModel
  final StreamController<List<CollectionItemModel>> _streamController =
      StreamController<List<CollectionItemModel>>.broadcast();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  Future<Database> _initDatabase() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, _dbName); // 使用 path.join
    return await openDatabase(
      path,
      version: _dbVersion,
      onCreate: _onCreate,
      // onUpgrade: _onUpgrade, // 在实际应用中处理数据库升级
    );
  }

  // 更新表结构
  Future<void> _onCreate(Database db, int version) async {
    await db.execute('''
      CREATE TABLE $_tableName (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        description TEXT NOT NULL, -- 添加 description 列
        type TEXT NOT NULL,       -- 存储 ContentType 字符串
        createTime TEXT NOT NULL, -- 存储 ISO8601 字符串
        tag TEXT NOT NULL         -- 将 source 改为 tag
      )
    ''');
  }

  // // 实际应用中需要的升级逻辑示例
  // Future<void> _onUpgrade(Database db, int oldVersion, int newVersion) async {
  //   if (oldVersion < 2) {
  //     // await db.execute("ALTER TABLE $_tableName ADD COLUMN description TEXT NOT NULL DEFAULT ''");
  //     // await db.execute("ALTER TABLE $_tableName RENAME COLUMN source TO tag"); // SQLite 不直接支持 RENAME COLUMN，需要更复杂的操作
  //     // 需要更复杂的迁移步骤来重命名列和更改类型
  //   }
  // }

  // 更新 watchItems 流类型
  Stream<List<CollectionItemModel>> watchItems() {
    getAllItems().then(_streamController.add).catchError((e) {
       print("Error fetching initial items for stream: $e");
       _streamController.addError(e); // 将错误发送到流
    });
    return _streamController.stream;
  }

  // 更新 insertItem 以使用 CollectionItemModel
  Future<int> insertItem(CollectionItemModel item) async {
    final db = await database;
    // 使用 CollectionItemModel 的 toJson 方法，但要移除 id (因为它是自增的)
    final map = item.toJson();
    map.remove('id'); // 移除 id，让数据库自动生成
    final id = await db.insert(_tableName, map);
    // 插入后刷新数据
    getAllItems().then(_streamController.add).catchError((e) {
       print("Error fetching items after insert: $e");
       _streamController.addError(e);
    });
    return id;
  }

  // 更新 getAllItems 以返回 List<CollectionItemModel>
  Future<List<CollectionItemModel>> getAllItems() async {
    final db = await database;
    final maps = await db.query(
      _tableName,
      orderBy: 'createTime DESC', // 按 createTime 排序
    );
    // 使用 CollectionItemModel.fromJson
    return List.generate(maps.length, (i) {
        // 需要手动添加 id，因为 CollectionItemModel.fromJson 不包含它
        final itemMap = Map<String, dynamic>.from(maps[i]);
        // 注意：CollectionItemModel 没有 id 字段，如果需要 id，需在模型中添加
        // 或者在需要的地方单独处理 id
        return CollectionItemModel.fromJson(itemMap);
    });
  }

   // 获取特定标签/文件夹下的项目
  Future<List<CollectionItemModel>> getItemsByTag(String tag) async {
    final db = await database;
    final maps = await db.query(
      _tableName,
      where: 'tag = ?',
      whereArgs: [tag],
      orderBy: 'createTime DESC',
    );
    return List.generate(maps.length, (i) {
      final itemMap = Map<String, dynamic>.from(maps[i]);
      return CollectionItemModel.fromJson(itemMap);
    });
  }

  // 获取所有唯一的标签
  Future<List<String>> getAllTags() async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query(
      _tableName,
      distinct: true,
      columns: ['tag'],
      orderBy: 'tag ASC', // 按标签字母顺序排序
    );
    // 提取 tag 字符串并过滤掉可能的 null 或空字符串
    // 提取 tag 字符串并过滤掉可能的 null 或空字符串，然后显式转换为 List<String>
    return maps.map((map) => map['tag'] as String?).where((tag) => tag != null && tag.isNotEmpty).cast<String>().toList();
  }


  // 更新 deleteItem
  // 注意：CollectionItemModel 本身没有 id，所以删除操作需要传入 id
  Future<int> deleteItem(int id) async {
    final db = await database;
    final result = await db.delete(
      _tableName,
      where: 'id = ?',
      whereArgs: [id],
    );
    // 删除后刷新数据
    // 注意：这里刷新的是 getAllItems，如果希望流只反映当前标签，需要调整
    getAllItems().then(_streamController.add).catchError((e) {
       print("Error fetching items after delete: $e");
       _streamController.addError(e);
    });
    return result;
  }

  // 更新单个项目的标签
  Future<int> updateItemTag(int id, String newTag) async {
    final db = await database;
    final result = await db.update(
      _tableName,
      {'tag': newTag},
      where: 'id = ?',
      whereArgs: [id],
    );
    // 更新后刷新数据
    // 注意：这里刷新的是 getAllItems，如果希望流只反映当前标签，需要调整
    getAllItems().then(_streamController.add).catchError((e) {
       print("Error fetching items after update tag: $e");
       _streamController.addError(e);
    });
    return result;
  }


  // 批量更新项目标签
  Future<void> batchUpdateItemTags(List<int> ids, String newTag) async {
    if (ids.isEmpty) return;
    final db = await database;
    await db.transaction((txn) async {
      for (final id in ids) {
        await txn.update(
          _tableName,
          {'tag': newTag},
          where: 'id = ?',
          whereArgs: [id],
        );
      }
    });
    // 批量更新后刷新数据
    getAllItems().then(_streamController.add).catchError((e) {
       print("Error fetching items after batch update tag: $e");
       _streamController.addError(e);
    });
  }


  Future<void> close() async {
    await _streamController.close();
    if (_database != null && _database!.isOpen) { // 检查数据库是否打开
      await _database!.close();
      _database = null; // 将 _database 设置为 null
    }
  }
}