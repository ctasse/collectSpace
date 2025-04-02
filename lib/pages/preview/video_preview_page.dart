import 'dart:io';
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

class VideoPreviewPage extends StatefulWidget {
  final String videoPath;
  final String? title; // 可选的标题

  const VideoPreviewPage({
    super.key,
    required this.videoPath,
    this.title,
  });

  @override
  State<VideoPreviewPage> createState() => _VideoPreviewPageState();
}

class _VideoPreviewPageState extends State<VideoPreviewPage> {
  late VideoPlayerController _controller;
  late Future<void> _initializeVideoPlayerFuture;
  bool _isPlaying = false;
  bool _showControls = true; // 控制是否显示播放控件

  @override
  void initState() {
    super.initState();
    final videoFile = File(widget.videoPath);

    // 检查文件是否存在
    if (videoFile.existsSync()) {
      _controller = VideoPlayerController.file(videoFile);
      _initializeVideoPlayerFuture = _controller.initialize().then((_) {
        // 初始化完成后自动播放
        _controller.play();
        setState(() {
          _isPlaying = true;
        });
        // 监听播放状态
        _controller.addListener(() {
          if (!mounted) return; // 确保 widget 仍然挂载
          final isPlaying = _controller.value.isPlaying;
          if (_isPlaying != isPlaying) {
            setState(() {
              _isPlaying = isPlaying;
            });
          }
          // 视频播放结束时重置状态
          if (_controller.value.position >= _controller.value.duration && !_controller.value.isLooping) {
             setState(() {
               _isPlaying = false;
               _controller.seekTo(Duration.zero); // 回到开头
             });
          }
        });
      }).catchError((error) {
        print("Error initializing video player: $error");
        // 可以在这里处理初始化错误，例如显示错误消息
      });
    } else {
      // 文件不存在，创建一个失败的 Future
      _initializeVideoPlayerFuture = Future.error('Video file not found');
      print("Video file not found: ${widget.videoPath}");
    }
  }

  @override
  void dispose() {
    // 确保释放资源
    _controller.dispose();
    super.dispose();
  }

  void _togglePlayPause() {
    if (_controller.value.isInitialized) {
      setState(() {
        if (_controller.value.isPlaying) {
          _controller.pause();
          _isPlaying = false;
        } else {
          // 如果视频已播放完毕，则从头开始播放
          if (_controller.value.position >= _controller.value.duration) {
             _controller.seekTo(Duration.zero);
          }
          _controller.play();
          _isPlaying = true;
        }
      });
    }
  }

  // 切换控件显示/隐藏
  void _toggleControls() {
    setState(() {
      _showControls = !_showControls;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: _showControls ? AppBar(
        backgroundColor: Colors.black.withOpacity(0.7),
        elevation: 0,
        title: Text(widget.title ?? '视频预览', style: const TextStyle(color: Colors.white)),
        iconTheme: const IconThemeData(color: Colors.white),
      ) : null, // 根据 _showControls 决定是否显示 AppBar
      extendBodyBehindAppBar: true, // 让内容延伸到 AppBar 后面
      body: GestureDetector( // 点击屏幕切换控件显示
        onTap: _toggleControls,
        child: FutureBuilder(
          future: _initializeVideoPlayerFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.done && !_controller.value.hasError) {
              return Stack(
                alignment: Alignment.center,
                children: [
                  Center(
                    child: AspectRatio(
                      aspectRatio: _controller.value.aspectRatio,
                      child: VideoPlayer(_controller),
                    ),
                  ),
                  // 播放/暂停按钮 (仅在显示控件时可见)
                  if (_showControls)
                    Positioned.fill(
                      child: Center(
                        child: IconButton(
                          icon: Icon(
                            _isPlaying ? Icons.pause_circle_filled : Icons.play_circle_filled,
                            color: Colors.white.withOpacity(0.8),
                            size: 64.0,
                          ),
                          onPressed: _togglePlayPause,
                        ),
                      ),
                    ),
                  // 进度条 (仅在显示控件时可见)
                  if (_showControls)
                    Positioned(
                      bottom: 20,
                      left: 20,
                      right: 20,
                      child: VideoProgressIndicator(
                        _controller,
                        allowScrubbing: true,
                        padding: const EdgeInsets.symmetric(vertical: 8.0),
                        colors: VideoProgressColors(
                          playedColor: Theme.of(context).primaryColor,
                          bufferedColor: Colors.white.withOpacity(0.5),
                          backgroundColor: Colors.white.withOpacity(0.2),
                        ),
                      ),
                    ),
                ],
              );
            } else if (snapshot.hasError) {
              return Center(
                child: Text(
                  '无法加载视频: ${snapshot.error}',
                  style: const TextStyle(color: Colors.redAccent),
                  textAlign: TextAlign.center,
                ),
              );
            } else {
              // 正在加载
              return const Center(child: CircularProgressIndicator(color: Colors.white));
            }
          },
        ),
      ),
    );
  }
}