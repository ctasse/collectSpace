import 'package:flutter/material.dart';

class CategoryMenu extends StatelessWidget {
  final List<String> categories = ['全部', '文字', '链接', '图片', '视频', '文件'];

  @override
  Widget build(BuildContext context) {
    // 获取当前主题的颜色
    final Color backgroundColor = Theme.of(context).scaffoldBackgroundColor;
    final Color itemColor = Theme.of(context).colorScheme.primary.withOpacity(0.1);
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDarkMode ? Colors.white : Colors.black;

    return Container(
      color: backgroundColor, // 使用主题背景颜色
      padding: const EdgeInsets.all(16),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2, // 每行两列
          crossAxisSpacing: 16, // 列间距
          mainAxisSpacing: 16, // 行间距
          childAspectRatio: 3, // 子项宽高比
        ),
        itemCount: categories.length,
        itemBuilder: (context, index) {
          return GestureDetector(
            onTap: () {
              // 处理分类点击事件
            },
            child: Container(
              decoration: BoxDecoration(
                color: itemColor, // 使用主题的主色作为子项背景
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Text(
                  categories[index],
                  style: TextStyle(color: textColor, fontSize: 16), // 使用主题的文字颜色
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}