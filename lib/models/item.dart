// 定义内容类型枚举
enum ContentType {
  text,    // 纯文字
  url,     // 网站地址
  image,   // 图片
  video,   // 视频
  file     // 文件
}

class CollectionItemModel {
  final int? id;             // 数据库 ID (可选，因为创建时可能没有)
  final String title;        // 标题
  final String content;      // 内容/URL/文件路径
  final String description;  // 描述信息
  final ContentType type;    // 内容类型
  final DateTime createTime; // 创建时间
  final String tag;         // 标签/文件夹

  CollectionItemModel({
    this.id, // id 变为可选
    required this.title,
    required this.content,
    required this.description,
    required this.type,
    required this.createTime,
    required this.tag,
  });

  // 从 JSON 转换 (数据库 Map)
  factory CollectionItemModel.fromJson(Map<String, dynamic> json) {
    return CollectionItemModel(
      id: json['id'] as int?, // 读取 id
      title: json['title'] as String,
      content: json['content'] as String,
      description: json['description'] as String? ?? '', // 处理可能的 null
      type: ContentType.values.firstWhere(
          (e) => e.toString() == 'ContentType.${json['type']}',
          orElse: () => ContentType.text), // 添加 orElse 以防类型错误
      createTime: DateTime.parse(json['createTime'] as String),
      tag: json['tag'] as String? ?? '未分类', // 处理可能的 null，给个默认值
    );
  }

  // 转换为 JSON (用于数据库存储)
  Map<String, dynamic> toJson() => {
        'id': id, // 包含 id
        'title': title,
        'content': content,
        'description': description,
        'type': type.toString().split('.').last,
        'createTime': createTime.toIso8601String(),
        'tag': tag,
      };
}
