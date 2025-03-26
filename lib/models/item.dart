// 定义内容类型枚举
enum ContentType {
  text,    // 纯文字
  url,     // 网站地址
  image,   // 图片
  video,   // 视频
  file     // 文件
}

class CollectionItemModel {
  final String title;        // 标题
  final String content;      // 内容/URL
  final String description;  // 描述信息
  final ContentType type;    // 内容类型
  final DateTime createTime; // 创建时间
  final String source;      // 来源

  CollectionItemModel({
    required this.title,
    required this.content,
    required this.description,
    required this.type,
    required this.createTime,
    required this.source,
  });

  // 从 JSON 转换
  factory CollectionItemModel.fromJson(Map<String, dynamic> json) {
    return CollectionItemModel(
      title: json['title'] as String,
      content: json['content'] as String,
      description: json['description'] as String,
      type: ContentType.values.firstWhere(
          (e) => e.toString() == 'ContentType.${json['type']}'),
      createTime: DateTime.parse(json['createTime'] as String),
      source: json['source'] as String,
    );
  }

  // 转换为 JSON
  Map<String, dynamic> toJson() => {
        'title': title,
        'content': content,
        'description': description,
        'type': type.toString().split('.').last,
        'createTime': createTime.toIso8601String(),
        'source': source,
      };
}
