import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p; // Use 'as p' to avoid conflicts
import 'package:receive_sharing_intent/receive_sharing_intent.dart';
import 'package:collect/models/shared_item.dart'; // Imports CollectionDatabase
import 'package:collect/models/item.dart';      // Imports CollectionItemModel

// 定义回调函数类型
typedef ItemReceivedCallback = void Function(Map<String, dynamic> itemData);

class ShareHandler {
  static const _sharedFilesDir = 'shared_files'; // 考虑改为公共存储
  // 使用 CollectionDatabase
  final CollectionDatabase _database = CollectionDatabase();
  ItemReceivedCallback? _onItemReceived; // 存储回调函数

  // TODO: 考虑将文件保存到公共存储目录，而不是应用文档目录
  Future<String> get _sharedFilesPath async {
    // 使用 getExternalStorageDirectory() 或类似的来获取公共目录
    // 需要添加 permission_handler 来请求权限
    // final Directory? extDir = await getExternalStorageDirectory();
    // final String dirPath = extDir != null ? p.join(extDir.path, 'CollectApp') : (await getApplicationDocumentsDirectory()).path;

    // 暂时还是使用应用文档目录
    final appDir = await getApplicationDocumentsDirectory();
    final sharedDir = Directory(p.join(appDir.path, _sharedFilesDir));

    if (!await sharedDir.exists()) {
      await sharedDir.create(recursive: true);
    }
    return sharedDir.path;
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

    final savePath = await _sharedFilesPath; // TODO: 改为公共存储路径
    List<Future<void>> processingFutures = []; // 用于存储每个文件处理的 Future

    for (final file in files) {
      // 为每个文件创建一个异步处理函数
      final Future<void> processingFuture = () async {
        final contentType = _getFileType(file.path);
        try {
          final fileName = p.basename(file.path);
          // TODO: 检查目标文件是否已存在，避免重复复制或提供重命名选项
          // 可以在这里添加逻辑来生成唯一文件名，例如：
          // String uniqueFileName = await _findUniqueFileName(savePath, fileName);
          // final destPath = p.join(savePath, uniqueFileName);
          final destPath = p.join(savePath, fileName); // 暂时保持原样

          // 复制文件 (异步)
          await File(file.path).copy(destPath);

          // 准备数据并通过回调传递
          final itemData = {
            'title': fileName, // 或者 uniqueFileName
            'type': contentType.toString().split('.').last,
            'content': destPath,
            'description': fileName, // 或者 uniqueFileName
          };
          // 在文件处理成功后立即调用回调
          _onItemReceived?.call(itemData);

        } catch (e) {
          print("Error processing file ${file.path}: $e");
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
       // 清理 intent，防止重复处理 (如果适用)
       // 最好在所有文件处理尝试完成后清理
       ReceiveSharingIntent.instance.reset(); // 清理媒体意图
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