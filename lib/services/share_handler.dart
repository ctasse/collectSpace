import 'dart:io';
import 'package:path_provider/path_provider.dart'; // 可能不再需要，取决于 StorageUtils 实现
import 'package:path/path.dart' as p; // Use 'as p' to avoid conflicts
import 'package:receive_sharing_intent/receive_sharing_intent.dart';
import 'package:collect/models/shared_item.dart'; // Imports CollectionDatabase
import 'package:collect/models/item.dart';      // Imports CollectionItemModel
import 'package:collect/utils/storage_utils.dart'; // 确保导入 StorageUtils
import 'package:collect/services/url_title_service.dart'; // Imports UrlTitleService
// 定义回调函数类型
typedef ItemReceivedCallback = void Function(Map<String, dynamic> itemData);

class ShareHandler {
  // 不再需要这个常量，或者可以更新它以反映新的子目录名（如果需要）
  // static const _sharedFilesDir = 'shared_files';

  // 使用 CollectionDatabase
  final CollectionDatabase _database = CollectionDatabase();
  ItemReceivedCallback? _onItemReceived; // 存储回调函数

  // 修改 _sharedFilesPath 以使用公共目录，返回 String?
  Future<String?> get _sharedFilesPath async {
    // 使用 StorageUtils 获取公共应用目录路径 (String?)
    final String? publicDirPath = await StorageUtils.getPublicAppDirectory();

    if (publicDirPath == null) {
      print("Error: Could not get public directory path.");
      return null; // 无法获取公共目录，返回 null
    }

    // 可以在公共目录下创建一个子目录来存放分享的文件，保持整洁
    // 例如: /storage/emulated/0/CollectApp/shared_imports
    final String sharedImportsPath = p.join(publicDirPath, 'shared_imports'); // 使用新的子目录名
    final sharedImportsDir = Directory(sharedImportsPath);

    try {
      if (!await sharedImportsDir.exists()) {
        await sharedImportsDir.create(recursive: true);
        print("Created shared imports directory: ${sharedImportsDir.path}");
      }
      return sharedImportsDir.path; // 返回子目录路径
    } catch (e) {
      print("Error creating/accessing shared imports directory: $e");
      // 如果创建或访问子目录失败，返回 null
      return null;
    }
  }

  // 修改方法以接受回调
  Future<void> handleSharedContent(ItemReceivedCallback onItemReceived) async {
    _onItemReceived = onItemReceived; // 保存回调

    // 处理初始分享内容
    try {
      // 处理所有类型的分享内容
      final initialMedia = await ReceiveSharingIntent.instance.getInitialMedia();
      if (initialMedia.isNotEmpty) {
        await _processMediaFiles(initialMedia);
      }
    } catch (e) {
       print("Error handling initial share intent: $e");
    }

    // 监听后续分享内容
    ReceiveSharingIntent.instance.getMediaStream().listen((files) async {
       try {
         if (files.isNotEmpty) {
           await _processMediaFiles(files);
         }
       } catch (e) {
         print("Error processing media stream: $e");
       }
    }, onError: (err) {
      print("Error in media stream: $err");
    });
  }

  // 处理媒体文件
  Future<void> _processMediaFiles(List<SharedMediaFile> files) async {
    if (files.isEmpty) return;

    // 获取正确的公共存储子目录路径 (例如 /storage/emulated/0/CollectApp/shared_imports)
    final savePath = await _sharedFilesPath;
    List<Future<void>> processingFutures = []; // 用于存储每个文件处理的 Future

    for (final file in files) {
      // 为每个文件创建一个异步处理函数
      final Future<void> processingFuture = () async {
        try {
          // 检查是否为URL
          if (file.path.startsWith('http://') || file.path.startsWith('https://')) {
            // 使用 UrlTitleService 获取标题
            final title = await UrlTitleService.fetchTitle(file.path) ?? file.path;
            final itemData = {
              'title': title,
              'type': ContentType.url.toString().split('.').last,
              'content': file.path,
              'description': '网页链接',
            };
            _onItemReceived?.call(itemData);
            return;
          }

          // 检查是否为文本内容
          if (!file.path.contains('/') && !file.path.contains('\\')) {
            // 直接处理为文本内容
            final itemData = {
              'title': file.path.length > 20 ? '${file.path.substring(0, 20)}...' : file.path,
              'type': ContentType.text.toString().split('.').last,
              'content': file.path,
              'description': '文本内容',
            };
            _onItemReceived?.call(itemData);
            return;
          }

          // 处理其他类型的文件（图片、视频等）
          final contentType = _getFileType(file.path);
          final originalFileName = p.basename(file.path);
          String uniqueFileName = await StorageUtils.findUniqueFileName(savePath!, originalFileName);
          final destPath = p.join(savePath!, uniqueFileName);

          print("Copying shared file from ${file.path} to $destPath");

          // 复制文件 (异步)
          await File(file.path).copy(destPath);
          print("Successfully copied to $destPath");

          // 准备数据并通过回调传递
          final itemData = {
            'title': p.basenameWithoutExtension(uniqueFileName),
            'type': contentType.toString().split('.').last,
            'content': destPath,
            'description': uniqueFileName,
          };
          _onItemReceived?.call(itemData);

          // 清理原始的临时缓存文件
          try {
            final originalFile = File(file.path);
            if (await originalFile.exists()) {
              await originalFile.delete();
              print("Deleted temporary cache file: ${file.path}");
            }
          } catch (deleteError) {
            print("Error deleting temporary cache file ${file.path}: $deleteError");
          }

        } catch (e) {
          print("Error processing file ${file.path}: $e");
          if (e is FileSystemException) {
            print("FileSystemException details: ${e.osError?.message} (${e.osError?.errorCode})");
          }
        }
      }();

      processingFutures.add(processingFuture);
    }

    // 等待所有文件处理完成
    try {
      await Future.wait(processingFutures);
      print("All ${files.length} files processed.");
    } catch (e) {
      print("Error during Future.wait for file processing: $e");
    }
  }


  // 返回 ContentType 枚举
  ContentType _getFileType(String filePath) {
    final ext = p.extension(filePath).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].contains(ext)) {
      return ContentType.image;
    } else if (['.mp4', '.mov', '.avi', '.wmv', '.mkv'].contains(ext)) {
      return ContentType.video;
    } else {
      // 其他所有类型都归为 file
      return ContentType.file;
    }
  }
}