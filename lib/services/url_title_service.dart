import 'dart:async';
import 'package:http/http.dart' as http;
import 'dart:io';
import 'package:html/parser.dart' show parse;
import 'package:html/dom.dart' as dom;

class UrlTitleService {
  // Fetches the title of a given URL.
  // Returns the title string on success, or null if fetching fails or no title is found.
  // Throws specific exceptions for different error types if needed, or returns null for simplicity.
  static Future<String?> fetchTitle(String urlString) async {
    Uri uri;
    try {
      // 确保 URL 格式正确
      if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
        urlString = 'https://$urlString';
      }
      uri = Uri.parse(urlString);

      // 添加超时以防止请求挂起
      final response = await http.get(uri).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        // 检查内容类型是否为 HTML
        final contentType = response.headers['content-type'];
        if (contentType != null && contentType.contains('text/html')) {
          final document = parse(response.body);
          final titleElement = document.querySelector('title');
          if (titleElement != null && titleElement.text.trim().isNotEmpty) {
            return titleElement.text.trim();
          } else {
            return null; // 未找到标题
          }
        } else {
          print('非 HTML 响应: $contentType');
          return null;
        }
      } else {
        print('HTTP 错误状态码: ${response.statusCode}');
        return null;
      }
    } on TimeoutException {
      print('请求超时: $urlString');
      return null;
    } on SocketException catch (e) {
      print('网络错误: $e');
      return null;
    } on FormatException {
      print('无效的 URL 格式: $urlString');
      return null;
    } catch (e) {
      print('未知错误: $e');
      return null;
    }
  }
}