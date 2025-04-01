import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:flutter/foundation.dart'; // for kDebugMode
import 'package:path/path.dart' as p;

class StorageUtils {

  static const String _publicDirName = "CollectApp"; // 应用在公共存储中的文件夹名

  /// Requests necessary storage permissions based on the Android version.
  /// Returns true if permissions are granted, false otherwise.
  static Future<bool> requestStoragePermission() async {
    if (defaultTargetPlatform == TargetPlatform.android) {
      // 检查 Android 11+ 的 MANAGE_EXTERNAL_STORAGE 权限
      if (Platform.isAndroid && await Permission.manageExternalStorage.isGranted) {
        return true;
      }

      // 请求存储权限
      final status = await Permission.storage.request();
      if (status.isGranted) {
        return true;
      }

      // 如果是 Android 11+，尝试请求 MANAGE_EXTERNAL_STORAGE
      if (Platform.isAndroid && status.isDenied) {
        final manageStatus = await Permission.manageExternalStorage.request();
        return manageStatus.isGranted;
      }

      // 如果权限被永久拒绝，引导用户到设置页面
      if (status.isPermanentlyDenied) {
        await openAppSettings();
      }

      return false;
    }

    // 非 Android 平台，假设权限已授予
    return true;
  }

  /// Gets the path to the application's directory within public storage.
  /// Creates the directory if it doesn't exist.
  /// Returns the path as a String, or null if unable to get the directory or permissions are denied.
  static Future<String?> getPublicAppDirectory() async {
    final permissionGranted = await requestStoragePermission();
    if (!permissionGranted) {
      print("Storage permission not granted. Cannot access public directory.");
      return null;
    }

    try {
      // 获取公共存储目录的根路径
      final Directory externalStorage = Directory('/storage/emulated/0');
      if (await externalStorage.exists()) {
        final String publicPath = p.join(externalStorage.path, _publicDirName);
        final Directory publicDir = Directory(publicPath);

        // 如果目录不存在，则创建
        if (!await publicDir.exists()) {
          await publicDir.create(recursive: true);
        }
        return publicDir.path;
      } else {
        print("External storage directory not available.");
        return null;
      }
    } catch (e) {
      print("Error accessing public directory: $e");
      return null;
    }
  }
}