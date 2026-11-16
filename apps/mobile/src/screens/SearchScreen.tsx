import { useEffect, useState } from "react";
import { Alert, FlatList, Share, StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  Appbar,
  Chip,
  List,
  Searchbar,
  Text,
  useTheme,
} from "react-native-paper";
import type { ContentType, ItemView } from "@collect/core";
import { useItemsStore } from "../stores/items";
import { notify, notifyError } from "../stores/ui";
import {
  DetailDialog,
  ImagePreview,
  VideoPreview,
} from "../components/PreviewModals";
import { RenameDialog, TagDialog } from "../components/AddDialogs";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const TYPES: { value: ContentType | null; label: string }[] = [
  { value: null, label: "全部" },
  { value: "text", label: "文本" },
  { value: "url", label: "链接" },
  { value: "image", label: "图片" },
  { value: "video", label: "视频" },
  { value: "file", label: "文件" },
];

function iconFor(type: ContentType): string {
  switch (type) {
    case "text":
      return "text-box-outline";
    case "url":
      return "link-variant";
    case "image":
      return "image-outline";
    case "video":
      return "play-circle-outline";
    default:
      return "file-outline";
  }
}

export function SearchScreen(): JSX.Element {
  const navigation = useNavigation<Nav>();
  const theme = useTheme();
  const items = useItemsStore((state) => state.items);
  const total = useItemsStore((state) => state.total);
  const loading = useItemsStore((state) => state.loading);
  const query = useItemsStore((state) => state.query);
  const type = useItemsStore((state) => state.type);
  const setQuery = useItemsStore((state) => state.setQuery);
  const setTypeFilter = useItemsStore((state) => state.setTypeFilter);
  const refresh = useItemsStore((state) => state.refresh);
  const remove = useItemsStore((state) => state.remove);

  const [imageItem, setImageItem] = useState<ItemView | null>(null);
  const [videoItem, setVideoItem] = useState<ItemView | null>(null);
  const [detailItem, setDetailItem] = useState<ItemView | null>(null);
  const [renameItem, setRenameItem] = useState<ItemView | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const open = (item: ItemView): void => {
    if (item.type === "image" && item.mediaUrl) setImageItem(item);
    else if (item.type === "video") setVideoItem(item);
    else setDetailItem(item);
  };

  const copy = (item: ItemView): void => {
    Clipboard.setStringAsync(item.content)
      .then(() => notify("已复制", "success"))
      .catch(notifyError);
  };

  const share = async (item: ItemView): Promise<void> => {
    try {
      if (item.mediaUrl) await Sharing.shareAsync(item.mediaUrl);
      else await Share.share({ message: item.content, title: item.title });
    } catch (caught) {
      notifyError(caught);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Searchbar
          placeholder="搜索标题、内容、描述、标签"
          value={query}
          onChangeText={setQuery}
          autoFocus
          style={styles.search}
          inputStyle={styles.searchInput}
        />
      </Appbar.Header>

      <View style={styles.chips}>
        {TYPES.map((item) => (
          <Chip
            key={item.label}
            compact
            selected={type === item.value}
            onPress={() => setTypeFilter(item.value)}
          >
            {item.label}
          </Chip>
        ))}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {loading ? "搜索中…" : `${total} 条结果`}
          </Text>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.empty} />
          ) : (
            <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>
              {query.trim() ? "没有匹配的收藏" : "输入关键词开始搜索"}
            </Text>
          )
        }
        renderItem={({ item }) => (
          <List.Item
            title={item.title}
            description={item.type === "text" ? item.content : item.type === "url" ? item.content : item.description}
            descriptionNumberOfLines={2}
            left={(props) => <List.Icon {...props} icon={iconFor(item.type)} />}
            right={() => (
              <View style={styles.right}>
                <Chip compact style={styles.rightChip}>
                  {item.tag}
                </Chip>
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                </Text>
              </View>
            )}
            onPress={() => open(item)}
            style={styles.row}
          />
        )}
      />

      <ImagePreview item={imageItem} onClose={() => setImageItem(null)} />
      {videoItem && (
        <VideoPreview item={videoItem} onClose={() => setVideoItem(null)} />
      )}
      <DetailDialog
        item={detailItem}
        onClose={() => setDetailItem(null)}
        onCopy={copy}
        onShare={(item) => void share(item)}
        onDelete={(item) => {
          setDetailItem(null);
          Alert.alert("删除收藏", `确定删除“${item.title}”吗？媒体文件会被永久删除。`, [
            { text: "取消", style: "cancel" },
            {
              text: "删除",
              style: "destructive",
              onPress: () => {
                remove([item.id])
                  .then((count) => notify(`已删除 ${count} 项`, "success"))
                  .catch(notifyError);
              },
            },
          ]);
        }}
        onRename={(item) => {
          setDetailItem(null);
          setRenameItem(item);
        }}
        onTag={(item) => {
          setDetailItem(null);
          setTagIds([item.id]);
        }}
      />
      <RenameDialog item={renameItem} onDismiss={() => setRenameItem(null)} />
      <TagDialog ids={tagIds} onDismiss={() => setTagIds([])} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  search: { flex: 1, marginRight: 8 },
  searchInput: { fontSize: 15 },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  list: { paddingHorizontal: 8, paddingBottom: 24 },
  row: { borderRadius: 12 },
  right: { alignItems: "flex-end", justifyContent: "center", gap: 4 },
  rightChip: { height: 24 },
  empty: { textAlign: "center", marginTop: 40 },
});
