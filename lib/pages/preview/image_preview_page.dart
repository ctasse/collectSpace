import 'dart:io';
import 'package:flutter/material.dart';
import 'package:photo_view/photo_view.dart';
import 'package:photo_view/photo_view_gallery.dart'; // 如果需要画廊功能

class ImagePreviewPage extends StatelessWidget {
  final String imagePath;
  final String? title; // 可选的标题

  const ImagePreviewPage({
    super.key,
    required this.imagePath,
    this.title,
  });

  @override
  Widget build(BuildContext context) {
    final imageFile = File(imagePath);

    return Scaffold(
      backgroundColor: Colors.black, // 黑色背景更适合预览
      appBar: AppBar(
        backgroundColor: Colors.black.withOpacity(0.7),
        elevation: 0, // 无阴影
        title: Text(title ?? '图片预览', style: const TextStyle(color: Colors.white)),
        iconTheme: const IconThemeData(color: Colors.white), // 返回按钮白色
      ),
      body: FutureBuilder<bool>(
        future: imageFile.exists(), // 检查文件是否存在
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator(color: Colors.white));
          }
          if (snapshot.data == true) {
            return PhotoView(
              imageProvider: FileImage(imageFile),
              minScale: PhotoViewComputedScale.contained * 0.8, // 最小缩放比例
              maxScale: PhotoViewComputedScale.covered * 2.0, // 最大缩放比例
              initialScale: PhotoViewComputedScale.contained, // 初始缩放以适应屏幕
              heroAttributes: PhotoViewHeroAttributes(tag: imagePath), // Hero 动画标签
              backgroundDecoration: const BoxDecoration(color: Colors.black),
              loadingBuilder: (context, event) => const Center(
                child: CircularProgressIndicator(color: Colors.white),
              ),
              errorBuilder: (context, error, stackTrace) {
                 print("Error loading image in PhotoView: $error");
                 return const Center(
                   child: Text('无法加载图片', style: TextStyle(color: Colors.redAccent)),
                 );
              },
            );
          } else {
            return const Center(
              child: Text('图片文件不存在', style: TextStyle(color: Colors.redAccent)),
            );
          }
        },
      ),
    );
  }
}