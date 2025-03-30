import 'package:sqflite/sqflite.dart';
import 'dart:async';

class SharedItem {
  final int? id;
  final String title;
  final String type; // 'text', 'image', 'file'
  final String content; // 文本内容或文件路径
  final DateTime createdAt;

  SharedItem({
    this.id,
    required this.title,
    required this.type,
    required this.content,
    required this.createdAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'title': title,
      'type': type,
      'content': content,
      'created_at': createdAt.millisecondsSinceEpoch,
    };
  }

  factory SharedItem.fromMap(Map<String, dynamic> map) {
    return SharedItem(
      id: map['id'],
      title: map['title'],
      type: map['type'],
      content: map['content'],
      createdAt: DateTime.fromMillisecondsSinceEpoch(map['created_at']),
    );
  }
}

class SharedItemDatabase {
  static const _dbName = 'shared_items.db';
  static const _dbVersion = 1;
  static const _tableName = 'shared_items';

  Database? _database;
  final StreamController<List<SharedItem>> _streamController = 
      StreamController<List<SharedItem>>.broadcast();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  Future<Database> _initDatabase() async {
    final dbPath = await getDatabasesPath();
    final path = '$dbPath/$_dbName';
    return await openDatabase(
      path,
      version: _dbVersion,
      onCreate: _onCreate,
    );
  }

  Future<void> _onCreate(Database db, int version) async {
    await db.execute('''
      CREATE TABLE $_tableName (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    ''');
  }

  Stream<List<SharedItem>> watchItems() {
    // 立即发送当前数据
    getAllItems().then(_streamController.add);
    return _streamController.stream;
  }

  Future<int> insertItem(SharedItem item) async {
    final db = await database;
    final id = await db.insert(_tableName, item.toMap());
    // 插入后刷新数据
    getAllItems().then(_streamController.add);
    return id;
  }

  Future<List<SharedItem>> getAllItems() async {
    final db = await database;
    final maps = await db.query(
      _tableName,
      orderBy: 'created_at DESC',
    );
    return List.generate(maps.length, (i) => SharedItem.fromMap(maps[i]));
  }

  Future<int> deleteItem(int id) async {
    final db = await database;
    final result = await db.delete(
      _tableName,
      where: 'id = ?',
      whereArgs: [id],
    );
    // 删除后刷新数据
    getAllItems().then(_streamController.add);
    return result;
  }

  Future<void> close() async {
    await _streamController.close();
    if (_database != null) {
      await _database!.close();
    }
  }
}