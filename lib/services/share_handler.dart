import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as path;
import 'package:receive_sharing_intent/receive_sharing_intent.dart';
import '../models/shared_item.dart';

class ShareHandler {
  static const _sharedFilesDir = 'shared_files';
  final SharedItemDatabase _database = SharedItemDatabase();

  Future<String> get _sharedFilesPath async {
    final appDir = await getApplicationDocumentsDirectory();
    final sharedDir = Directory(path.join(appDir.path, _sharedFilesDir));
    if (!await sharedDir.exists()) {
      await sharedDir.create(recursive: true);
    }
    return sharedDir.path;
  }

  Future<void> handleSharedContent() async {
    // 处理初始分享内容
    final initialMedia = await ReceiveSharingIntent.instance.getInitialMedia();
    await _processMediaFiles(initialMedia);

    // 监听后续分享内容
    ReceiveSharingIntent.instance.getMediaStream().listen((files) async {
      await _processMediaFiles(files);
    });
  }

  Future<void> _processMediaFiles(List<SharedMediaFile> files) async {
    if (files.isEmpty) return;

    final savePath = await _sharedFilesPath;
    for (final file in files) {
      final fileName = path.basename(file.path);
      final destPath = path.join(savePath, fileName);
      
      await File(file.path).copy(destPath);

      final item = SharedItem(
        title: fileName,
        type: _getFileType(file.path),
        content: destPath,
        createdAt: DateTime.now(),
      );
      await _database.insertItem(item);
    }
  }

  String _getFileType(String filePath) {
    final ext = path.extension(filePath).toLowerCase();
    if (ext == '.jpg' || ext == '.jpeg' || ext == '.png' || ext == '.gif') {
      return 'image';
    }
    return 'file';
  }
}