import 'package:flutter/material.dart';
import 'package:collect/models/shared_item.dart';

class CollectionItem extends StatelessWidget {
  final SharedItem item;

  const CollectionItem({super.key, required this.item});

  IconData _getIconForType(String type) {
    switch (type) {
      case 'text':
        return Icons.text_snippet;
      case 'url':
        return Icons.link;
      case 'image':
        return Icons.image;
      case 'video':
        return Icons.video_library;
      default:
        return Icons.insert_drive_file;
    }
  }

  Color _getColorForType(String type) {
    switch (type) {
      case 'text':
        return Colors.grey.shade200;
      case 'url':
        return Colors.green.shade200;
      case 'image':
        return Colors.blue.shade200;
      case 'video':
        return Colors.red.shade200;
      default:
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
            Text(
              item.createdAt.toString().substring(0, 16),
              style: const TextStyle(
                color: Colors.white38,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
