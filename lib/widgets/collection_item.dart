import 'dart:io';
import 'package:flutter/material.dart';
import 'package:collect/models/item.dart'; // 使用 CollectionItemModel
import 'package:file_icon/file_icon.dart';
import 'package:video_thumbnail/video_thumbnail.dart'; // 用于视频缩略图
import 'package:path/path.dart' as p; // 用于获取文件扩展名
import 'package:path_provider/path_provider.dart'; // 用于获取临时目录
import 'package:flutter/foundation.dart'; // for kDebugMode
import 'package:collect/pages/preview/image_preview_page.dart'; // 导入图片预览页面
import 'package:collect/pages/preview/video_preview_page.dart'; // 导入视频预览页面
import 'package:url_launcher/url_launcher.dart'; // 用于打开链接

class CollectionItem extends StatefulWidget {
  final CollectionItemModel item;
  final VoidCallback? onShare;
  final VoidCallback? onDelete;
  final bool isSelecting;
  final bool isSelected;
  final VoidCallback? onChangeTag;
  // 添加新的回调
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;

  const CollectionItem({
    super.key,
    required this.item,
    this.onShare,
    this.onDelete,
    this.isSelecting = false,
    this.isSelected = false,
    this.onChangeTag,
    this.onTap,
    this.onLongPress,
  });

  @override
  State<CollectionItem> createState() => _CollectionItemState();
}

class _CollectionItemState extends State<CollectionItem> {
  // 使用 Future 来管理缩略图的异步加载
  late Future<String?> _thumbnailFuture;
  String? _generatedThumbnailPath; // 保存生成的缩略图路径，以便清理

  @override
  void initState() {
    super.initState();
    if (widget.item.type == ContentType.video) {
      _thumbnailFuture = _generateThumbnail();
    } else {
      // 对于非视频类型，创建一个已完成的 Future<Null>，避免 FutureBuilder 出错
      _thumbnailFuture = Future.value(null);
    }
  }

  // 修改为返回 Future<String?>
  Future<String?> _generateThumbnail() async {
    // 确保 content 是有效的文件路径
    if (widget.item.content.isEmpty || !(widget.item.content.contains('/') || widget.item.content.contains('\\'))) {
       if (kDebugMode) {
         print("Invalid video path for thumbnail generation: ${widget.item.content}");
       }
       return null;
    }

    final file = File(widget.item.content);
    if (!await file.exists()) { // 检查文件是否存在
      if (kDebugMode) {
        print("Video file does not exist: ${widget.item.content}");
      }
      return null; // 文件不存在
    }

    try {
      final tempDir = await getTemporaryDirectory(); // 获取临时目录
      final thumbnailPath = await VideoThumbnail.thumbnailFile(
        video: widget.item.content,
        thumbnailPath: tempDir.path, // 指定临时目录存储缩略图
        imageFormat: ImageFormat.WEBP, // WEBP 格式通常较小
        maxHeight: 256, // 提高缩略图质量
        quality: 75,
      );
      _generatedThumbnailPath = thumbnailPath; // 保存路径以便清理
      return thumbnailPath; // 返回生成的路径
    } catch (e) {
       if (kDebugMode) {
         print("Error generating thumbnail for ${widget.item.content}: $e");
       }
       return null; // 出错时返回 null
    }
  }

  Widget _buildPreview() {
    switch (widget.item.type) {
      case ContentType.image:
        final imageFile = File(widget.item.content);
        // 检查文件是否存在且路径有效
        if (widget.item.content.isNotEmpty && (widget.item.content.contains('/') || widget.item.content.contains('\\'))) {
           return FutureBuilder<bool>(
             future: imageFile.exists(), // 异步检查文件是否存在
             builder: (context, snapshot) {
               if (snapshot.connectionState == ConnectionState.waiting) {
                 return const Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)));
               }
               if (snapshot.data == true) {
                 return Image.file(
                   imageFile,
                   fit: BoxFit.cover,
                   width: double.infinity,
                   height: double.infinity,
                   errorBuilder: (context, error, stackTrace) {
                      if (kDebugMode) print("Error loading image ${widget.item.content}: $error");
                      return _buildErrorPlaceholder("图片加载失败");
                   }
                 );
               } else {
                 return _buildErrorPlaceholder("图片文件不存在");
               }
             },
           );
        } else {
           return _buildErrorPlaceholder("无效图片路径");
        }

      case ContentType.video:
        // 使用 FutureBuilder 处理视频缩略图
        return FutureBuilder<String?>(
          future: _thumbnailFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              // 显示加载指示器
              return const Center(
                child: SizedBox(
                  width: 30,
                  height: 30,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white60),
                ),
              );
            } else if (snapshot.hasError || snapshot.data == null) {
              // 显示错误或默认图标
              if (kDebugMode) print("Thumbnail Future error or null data: ${snapshot.error}");
              return _buildIconPlaceholder(Icons.movie_creation_outlined, "视频"); // 使用电影图标
            } else {
              // 显示缩略图
              final thumbnailFile = File(snapshot.data!);
              // 再次检查缩略图文件是否存在
              return FutureBuilder<bool>(
                 future: thumbnailFile.exists(),
                 builder: (context, fileSnapshot) {
                    if (fileSnapshot.connectionState == ConnectionState.waiting) {
                       return const Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)));
                    }
                    if (fileSnapshot.data == true) {
                       return Image.file(
                         thumbnailFile,
                         fit: BoxFit.cover,
                         width: double.infinity,
                         height: double.infinity,
                         errorBuilder: (context, error, stackTrace) {
                            if (kDebugMode) print("Error loading thumbnail image file ${snapshot.data!}: $error");
                            return _buildIconPlaceholder(Icons.movie_creation_outlined, "视频");
                         }
                       );
                    } else {
                       if (kDebugMode) print("Generated thumbnail file not found: ${snapshot.data!}");
                       return _buildIconPlaceholder(Icons.movie_creation_outlined, "视频"); // 缩略图文件本身不存在
                    }
                 }
              );
            }
          },
        );
      case ContentType.file:
        // 假设 content 存储的是文件路径
        final fileName = p.basename(widget.item.content);
        final fileExtension = p.extension(widget.item.content);
        return Container(
          color: Colors.grey[800], // 给文件预览一个背景色
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                FileIcon(fileExtension, size: 48), // 增大图标
                const SizedBox(height: 8),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8.0),
                  child: Text(
                    fileName,
                    style: const TextStyle(color: Colors.white, fontSize: 13), // 调整字体
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        );
      case ContentType.url:
         return Container(
          color: Colors.grey[850],
          padding: const EdgeInsets.all(12.0), // 增加内边距
          alignment: Alignment.center,
          child: Column( // 使用 Column 放置图标和文本
             mainAxisAlignment: MainAxisAlignment.center,
             children: [
                Icon(Icons.link, color: Colors.blue[300], size: 40),
                const SizedBox(height: 8),
                Text(
                  widget.item.content, // 直接显示URL
                  style: TextStyle(color: Colors.blue[300], fontSize: 12),
                   textAlign: TextAlign.center,
                   maxLines: 3, // 减少行数，避免过多显示
                   overflow: TextOverflow.ellipsis,
                ),
             ],
          )
        );
      case ContentType.text:
      default:
        return Container(
          color: Colors.grey[850],
          padding: const EdgeInsets.all(12.0), // 增加内边距
          alignment: Alignment.center,
           child: Column( // 使用 Column 放置图标和文本
             mainAxisAlignment: MainAxisAlignment.center,
             children: [
                const Icon(Icons.text_fields, color: Colors.white70, size: 40),
                const SizedBox(height: 8),
                Text(
                  widget.item.content,
                  style: const TextStyle(color: Colors.white, fontSize: 12),
                  textAlign: TextAlign.center,
                  maxLines: 4, // 调整最大行数
                  overflow: TextOverflow.ellipsis,
                ),
             ],
          )
        );
    }
  }

  Widget _buildErrorPlaceholder(String message) {
    return Container(
      color: Colors.grey[800],
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(8.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, color: Colors.redAccent, size: 30),
              const SizedBox(height: 4),
              Text(
                 message,
                 style: const TextStyle(color: Colors.white70, fontSize: 10),
                 textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }

   Widget _buildIconPlaceholder(IconData icon, String label) {
    return Container(
      color: Colors.grey[800],
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: Colors.white60, size: 48), // 增大图标
            const SizedBox(height: 4),
            Text(label, style: const TextStyle(color: Colors.white70, fontSize: 12)),
          ],
        ),
      ),
    );
  }


@override
Widget build(BuildContext context) {
  
  return GestureDetector(
    onTap: widget.onTap,
    onLongPress: widget.onLongPress,
    child: Card(
      elevation: 2.0,
      margin: EdgeInsets.zero,
      color: Colors.grey[900],
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: widget.isSelected
            ? BorderSide(color: Theme.of(context).primaryColorLight, width: 2.0)
            : BorderSide.none,
      ),
      child: AspectRatio( // 使用 AspectRatio 保持固定比例
        aspectRatio: 1.0, // 保持 1:1 比例
        child: Stack(
          children: [
            // --- 背景预览 ---
            Positioned.fill(
              child: _buildPreview(),
            ),

            // --- 选中状态覆盖层 ---
            if (widget.isSelected)
              Positioned.fill(
                child: Container(
                  decoration: BoxDecoration(
                    color: Theme.of(context).primaryColor.withOpacity(0.3), // 半透明覆盖
                    borderRadius: BorderRadius.circular(8), // 保持圆角一致
                  ),
                  child: Icon( // 添加勾选图标
                    Icons.check_circle_outline,
                    color: Colors.white.withOpacity(0.8),
                    size: 40,
                  ),
                ),
              ),

            // --- 底部渐变遮罩 (增强标题和按钮可读性) ---
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: Container(
                height: 60, // 增加遮罩高度以覆盖按钮背景
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    stops: const [0.0, 0.8, 1.0], // 调整渐变停止点
                    colors: [
                      Colors.transparent,
                      Colors.black.withOpacity(0.6), // 中间开始变黑
                      Colors.black.withOpacity(0.8), // 底部更黑
                    ],
                  ),
                ),
              ),
            ),

            // --- 标题 (左下角) ---
            Positioned(
              bottom: 8,
              left: 10, // 增加左边距
              right: 48, // 增加右边距以避开按钮
              child: Text(
                widget.item.title,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  shadows: [ // 添加阴影以提高可读性
                    Shadow(blurRadius: 3.0, color: Colors.black87, offset: Offset(1.0, 1.0)),
                  ]
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),

            // --- 更多选项按钮 (右下角) ---
            Positioned(
              bottom: 0,
              right: 0,
              child: PopupMenuButton<String>(
                icon: const Icon(Icons.more_vert, color: Colors.white), // 使用 more_vert 图标
                 tooltip: "更多选项",
                 // 调整弹出位置，使其不那么靠边
                 offset: const Offset(0, 40),
                onSelected: (String result) {
                  switch (result) {
                    case 'share':
                      widget.onShare?.call();
                      break;
                    case 'delete':
                      widget.onDelete?.call();
                      break;
                    case 'change_tag':
                      widget.onChangeTag?.call();
                      break;
                  }
                },
                itemBuilder: (BuildContext context) => <PopupMenuEntry<String>>[
                  const PopupMenuItem<String>(
                    value: 'share',
                    child: ListTile(leading: Icon(Icons.share), title: Text('分享')),
                  ),
                  const PopupMenuItem<String>(
                    value: 'delete',
                    child: ListTile(leading: Icon(Icons.delete_outline, color: Colors.redAccent), title: Text('删除', style: TextStyle(color: Colors.redAccent))),
                  ),
                  // 添加修改文件夹选项
                  if (widget.onChangeTag != null && !widget.isSelecting) // 仅在非选择模式下显示
                    const PopupMenuDivider(), // 分隔线
                  if (widget.onChangeTag != null && !widget.isSelecting)
                    const PopupMenuItem<String>(
                      value: 'change_tag', // 新增 value
                      child: ListTile(leading: Icon(Icons.low_priority), title: Text('修改文件夹')),
                    ),
                ],
                color: Colors.grey[850], // 菜单背景色
                 shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)), // 圆角
              ),
            ),
          ],
        ),
        ),
      ),
    );
  }

   @override
  void dispose() {
    // 尝试删除生成的临时缩略图文件
    if (_generatedThumbnailPath != null) {
      final file = File(_generatedThumbnailPath!);
      file.exists().then((exists) {
        if (exists) {
          file.delete().then((_) {
             if (kDebugMode) print("Deleted temporary thumbnail: $_generatedThumbnailPath");
          }).catchError((e) {
             if (kDebugMode) print("Error deleting temporary thumbnail $_generatedThumbnailPath: $e");
          });
        }
      });
    }
    super.dispose();
  }

  // --- 点击事件处理 ---
  void _handleTap(BuildContext context) {
    final item = widget.item;
    switch (item.type) {
      case ContentType.image:
        if (kDebugMode) print("Tapped on image: ${item.content}");
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => ImagePreviewPage(
              imagePath: item.content,
              title: item.title, // 传递标题
            ),
          ),
        );
        break;
      case ContentType.video:
        if (kDebugMode) print("Tapped on video: ${item.content}");
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => VideoPreviewPage(
              videoPath: item.content,
              title: item.title, // 传递标题
            ),
          ),
        );
        break;
      case ContentType.text:
        if (kDebugMode) print("Tapped on text: ${item.content}");
        // 显示文本预览对话框
        showDialog(
          context: context,
          builder: (context) {
            return AlertDialog(
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
            );
          },
        );
        break;
      case ContentType.url:
        if (kDebugMode) print("Tapped on url: ${item.content}");
        // TODO: 考虑是否打开链接或显示预览
        // 例如使用 url_launcher 打开链接
        final Uri url = Uri.parse(item.content);
        if (url.scheme == 'http' || url.scheme == 'https') {
          launchUrl(url, mode: LaunchMode.externalApplication).catchError((e) {
            if (kDebugMode) print("Error opening URL: $e");
          });
        } else {
          // 如果不是有效的 URL，显示错误提示
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text("无效的链接格式")),
          );
        }
        break;
      case ContentType.file:
        if (kDebugMode) print("Tapped on file: ${item.content}");
        // TODO: 考虑是否打开文件或显示信息
        // 例如使用 file_picker 或其他库打开文件
        
        // 使用系统分享页面
        if (widget.item.content.isNotEmpty) {
          widget.onShare?.call(); // 调用分享回调
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
}
