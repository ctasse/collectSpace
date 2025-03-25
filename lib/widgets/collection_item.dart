import 'package:flutter/material.dart';
import 'package:collect/models/item.dart';

class CollectionItem extends StatelessWidget {
  final CollectionItemModel item;

  const CollectionItem({required this.item});

  IconData _getIconForType(String type) {
    switch (type) {
      case 'image':
        return Icons.image;
      case 'video':
        return Icons.video_library;
      case 'link':
        return Icons.link;
      case 'pdf':
        return Icons.picture_as_pdf;
      default:
        return Icons.folder;
    }
  }

  Color _getColorForType(String type) {
    switch (type) {
      case 'image':
        return Colors.blue.shade200;
      case 'video':
        return Colors.amber.shade200;
      case 'link':
        return Colors.green.shade200;
      case 'pdf':
        return Colors.red.shade200;
      default:
        return Colors.grey.shade200;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Colors.grey[900],
      child: Container(
        padding: EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  _getIconForType(item.type),
                  color: _getColorForType(item.type),
                ),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    item.title,
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                PopupMenuButton(
                  icon: Icon(Icons.more_horiz, color: Colors.white),
                  itemBuilder: (context) => [
                    PopupMenuItem(
                      child: Text('分享'),
                      value: 'share',
                    ),
                    PopupMenuItem(
                      child: Text('删除'),
                      value: 'delete',
                    ),
                  ],
                ),
              ],
            ),
            Expanded(
              child: Container(
                alignment: Alignment.center,
                child: Text(
                  '${item.itemCount} 项',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 14,
                  ),
                ),
              ),
            ),
            Text(
              item.data,
              style: TextStyle(
                color: Colors.white60,
                fontSize: 12,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            SizedBox(height: 4),
            Text(
              'From: ${item.from}',
              style: TextStyle(
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
