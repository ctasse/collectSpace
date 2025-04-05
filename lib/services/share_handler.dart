import 'dart:io';
import 'package:path_provider/path_provider.dart'; // 可能不再需要，取决于 StorageUtils 实现
import 'package:path/path.dart' as p; // Use 'as p' to avoid conflicts
import 'package:receive_sharing_intent/receive_sharing_intent.dart';
import 'package:collect/models/shared_item.dart'; // Imports CollectionDatabase
import 'package:collect/models/item.dart';      // Imports CollectionItemModel
import 'package:collect/utils/storage_utils.dart'; // 确保导入 StorageUtils
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

    // 处理初始分享内容 - 只处理媒体
    try {
      final initialMedia = await ReceiveSharingIntent.instance.getInitialMedia();
      await _processMediaFiles(initialMedia);

      // // 移除文本/链接处理
      // final initialLink = await ReceiveSharingIntent.instance.getInitialLink();
      // await _processText(initialLink);

    } catch (e) {
       print("Error handling initial share intent: $e");
    }


    // 监听后续分享内容 - 只处理媒体
    ReceiveSharingIntent.instance.getMediaStream().listen((files) async {
       try {
         await _processMediaFiles(files);
       } catch (e) {
         print("Error processing media stream: $e");
       }
    }, onError: (err) {
      print("Error in media stream: $err");
    });

    // // 移除文本/链接流监听
    // ReceiveSharingIntent.instance.getLinkStream().listen((link) async {
    //    try {
    //      await _processText(link);
    //    } catch (e) {
    //      print("Error processing text stream: $e");
    //    }
    // }, onError: (err) {
    //   print("Error in link stream: $err");
    // });
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
        final contentType = _getFileType(file.path);
        try {
          final originalFileName = p.basename(file.path);
          // 考虑文件名冲突处理
          // Since we checked savePath != null earlier, we can use the null assertion operator (!) here.
          String uniqueFileName = await StorageUtils.findUniqueFileName(savePath!, originalFileName);
          final destPath = p.join(savePath!, uniqueFileName);

          print("Copying shared file from ${file.path} to $destPath"); // 添加日志

          // 复制文件 (异步)
          await File(file.path).copy(destPath);
          print("Successfully copied to $destPath"); // 添加日志

          // 准备数据并通过回调传递
          final itemData = {
            'title': p.basenameWithoutExtension(uniqueFileName), // 使用去除了后缀的唯一文件名作为标题
            'type': contentType.toString().split('.').last,
            'content': destPath, // 使用新的公共路径
            'description': uniqueFileName, // 描述可以是完整唯一文件名
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
            // 即使删除失败，也继续执行，因为文件已成功复制
          }

        } catch (e) {
          print("Error processing file ${file.path}: $e");
          // 添加更详细的错误日志
          if (e is FileSystemException) {
            print("FileSystemException details: ${e.osError?.message} (${e.osError?.errorCode})");
          }
          // 可以考虑在这里通知用户某个文件处理失败，例如通过不同的回调或日志
        }
      }(); // 立即执行异步函数以返回 Future

      processingFutures.add(processingFuture); // 将 Future 添加到列表
    }

    // 等待所有文件处理完成
    try {
      await Future.wait(processingFutures);
      print("All ${files.length} files processed.");
    } catch (e) {
      // Future.wait 本身在有错误时会抛出第一个遇到的错误，
      // 但我们已经在单个文件处理中捕获了错误，所以这里可能不需要额外处理，
      // 除非希望在所有任务完成后进行某些最终操作。
      print("Error during Future.wait for file processing: $e");
    } finally {
       // 考虑是否真的需要在每次处理后都 reset
       // ReceiveSharingIntent.instance.reset();
    }
  }

  // // 辅助函数：查找唯一文件名 (如果需要) - 可以从 CollectionPage 移到这里或公共工具类
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

  // // 移除 _processText 方法
  // Future<void> _processText(String? text) async { ... }


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