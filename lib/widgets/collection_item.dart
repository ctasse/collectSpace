import 'package:flutter/material.dart';
import 'package:collect/models/item.dart';

class CollectionItem extends StatelessWidget {
  final CollectionItemModel item;

  const CollectionItem({super.key, required this.item});

  IconData _getIconForType(ContentType type) {
    switch (type) {
      case ContentType.text:
        return Icons.text_snippet;
      case ContentType.url:
        return Icons.link;
      case ContentType.image:
        return Icons.image;
      case ContentType.video:
        return Icons.video_library;
      case ContentType.file:
        return Icons.insert_drive_file;
    }
  }

  Color _getColorForType(ContentType type) {
    switch (type) {
      case ContentType.text:
        return Colors.grey.shade200;
      case ContentType.url:
        return Colors.green.shade200;
      case ContentType.image:
        return Colors.blue.shade200;
      case ContentType.video:
        return Colors.red.shade200;
      case ContentType.file:
        return Colors.amber.shade200;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Colors.grey[900],
      child: Container(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  _getIconForType(item.type),
                  color: _getColorForType(item.type),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    item.title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                PopupMenuButton(
                  icon: const Icon(Icons.more_horiz, color: Colors.white),
                  itemBuilder: (context) => [
                    const PopupMenuItem(
                      value: 'share',
                      child: Text('分享'),
                    ),
                    const PopupMenuItem(
                      value: 'delete',
                      child: Text('删除'),
                    ),
                  ],
                ),
              ],
            ),
            if (item.description.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                item.description,
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 14,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
            const SizedBox(height: 8),
            Text(
              item.content,
              style: const TextStyle(
                color: Colors.white60,
                fontSize: 12,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'From: ${item.source}',
                  style: const TextStyle(
                    color: Colors.white38,
                    fontSize: 12,
                  ),
                ),
                Text(
                  item.createTime.toString().substring(0, 16),
                  style: const TextStyle(
                    color: Colors.white38,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
