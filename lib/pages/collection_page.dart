import 'package:flutter/material.dart';
import 'package:collect/widgets/collection_item.dart';
import 'package:collect/models/item.dart';

class CollectionPage extends StatelessWidget {
  final List<CollectionItemModel> items = [
    CollectionItemModel(
      title: 'QQ',
      data: '游戏截图',
      from: '腾讯',
      type: 'image',
      itemCount: 6,
    ),
    CollectionItemModel(
      title: '视频',
      data: '#MagicOS8.0# #荣耀100Pro#',
      from: '酷安',
      type: 'video',
      itemCount: 2,
    ),
    CollectionItemModel(
      title: 'hold',
      data: 'https://eths.itch.io/the-m...',
      from: '网页',
      type: 'link',
      itemCount: 1,
    ),
    CollectionItemModel(
      title: '图库',
      data: '游戏截图集',
      from: '本地',
      type: 'image',
      itemCount: 4,
    ),
    CollectionItemModel(
      title: '简历.pdf',
      data: '100KB',
      from: '文件',
      type: 'pdf',
      itemCount: 1,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        title: Text('收藏空间', style: TextStyle(color: Colors.white)),
        actions: [
          IconButton(
            icon: Icon(Icons.search, color: Colors.white),
            onPressed: () {},
          ),
          IconButton(
            icon: Icon(Icons.filter_alt, color: Colors.white),
            onPressed: () {},
          ),
          IconButton(
            icon: Icon(Icons.more_vert, color: Colors.white),
            onPressed: () {},
          ),
        ],
      ),
      body: GridView.builder(
        padding: EdgeInsets.all(8),
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          childAspectRatio: 1.0,
          crossAxisSpacing: 8,
          mainAxisSpacing: 8,
        ),
        itemCount: items.length,
        itemBuilder: (context, index) {
          return CollectionItem(item: items[index]);
        },
      ),
    );
  }
}
