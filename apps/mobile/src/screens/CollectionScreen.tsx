import { useEffect, useState } from "react";
import { Alert, FlatList, RefreshControl, Share, StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  Appbar,
  Button,
  Chip,
  FAB,
  HelperText,
  Text,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ItemView } from "@collect/core";
import { ItemCard, type CardAction } from "../components/ItemCard";
import { SelectionBar } from "../components/SelectionBar";
import { TagSheet } from "../components/TagSheet";
import {
  DetailDialog,
  ImagePreview,
  VideoPreview,
} from "../components/PreviewModals";
import {
  RenameDialog,
  TagDialog,
  TextDialog,
  UrlDialog,
} from "../components/AddDialogs";
import { useItemsStore } from "../stores/items";
import { notify, notifyError } from "../stores/ui";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function CollectionScreen(): JSX.Element {
  const navigation = useNavigation<Nav>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const items = useItemsStore((state) => state.items);
  const total = useItemsStore((state) => state.total);
  const loading = useItemsStore((state) => state.loading);
  const loadingMore = useItemsStore((state) => state.loadingMore);
  const error = useItemsStore((state) => state.error);
  const tag = useItemsStore((state) => state.tag);
  const query = useItemsStore((state) => state.query);
  const selected = useItemsStore((state) => state.selected);
  const init = useItemsStore((state) => state.init);
  const refresh = useItemsStore((state) => state.refresh);
  const loadMore = useItemsStore((state) => state.loadMore);
  const toggleSelect = useItemsStore((state) => state.toggleSelect);
  const selectAll = useItemsStore((state) => state.selectAll);
  const clearSelection = useItemsStore((state) => state.clearSelection);
  const remove = useItemsStore((state) => state.remove);
  const importFiles = useItemsStore((state) => state.importFiles);

  const [tagOpen, setTagOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [renameItem, setRenameItem] = useState<ItemView | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [tagInitial, setTagInitial] = useState<string | undefined>();
  const [imageItem, setImageItem] = useState<ItemView | null>(null);
  const [videoItem, setVideoItem] = useState<ItemView | null>(null);
  const [detailItem, setDetailItem] = useState<ItemView | null>(null);

  useEffect(() => {
    void init();
  }, [init]);

  const pickFiles = async (): Promise<void> => {
    setFabOpen(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const files = result.assets.map((asset) => ({
        uri: asset.uri,
        fileName: asset.name || "文件",
        mimeType: asset.mimeType,
      }));
      const res = await importFiles(files);
      if (res.imported > 0) notify(`已添加 ${res.imported} 个文件`, "success");
      if (res.failed.length > 0) notify(res.failed[0] ?? "部分文件导入失败", "error");
    } catch (caught) {
      notifyError(caught);
    }
  };

  const confirmDelete = (targets: ItemView[]): void => {
    if (targets.length === 0) return;
    Alert.alert(
      "删除收藏",
      `确定删除 ${targets.length} 项吗？媒体文件会被永久删除，且无法恢复。`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "删除",
          style: "destructive",
          onPress: () => {
            void remove(targets.map((item) => item.id))
              .then((count) => {
                clearSelection();
                setDetailItem(null);
                notify(`已删除 ${count} 项`, "success");
              })
              .catch(notifyError);
          },
        },
      ],
    );
  };

  const copy = (item: ItemView): void => {
    Clipboard.setStringAsync(item.content)
      .then(() => notify("已复制", "success"))
      .catch(notifyError);
  };

  const share = async (item: ItemView): Promise<void> => {
    try {
      if (item.mediaUrl) {
        await Sharing.shareAsync(item.mediaUrl, {
          mimeType: item.type === "image" ? "image/*" : undefined,
        });
      } else {
        await Share.share({ message: item.content, title: item.title });
      }
    } catch (caught) {
      notifyError(caught);
    }
  };

  const openItem = (item: ItemView): void => {
    if (item.type === "image" && item.mediaUrl) {
      setImageItem(item);
      return;
    }
    if (item.type === "video") {
      setVideoItem(item);
      return;
    }
    setDetailItem(item);
  };

  const handleAction = (action: CardAction, item: ItemView): void => {
    switch (action) {
      case "open":
        openItem(item);
        break;
      case "rename":
        setRenameItem(item);
        break;
      case "tag":
        setTagIds([item.id]);
        setTagInitial(item.tag);
        break;
      case "copy":
        copy(item);
        break;
      case "share":
        void share(item);
        break;
      case "delete":
        confirmDelete([item]);
        break;
    }
  };

  const onCardPress = (item: ItemView): void => {
    if (selected.length > 0) {
      toggleSelect(item.id);
      return;
    }
    openItem(item);
  };

  const selectionMode = selected.length > 0;
  const filtered = Boolean(query.trim() || tag);

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header elevated>
        <Appbar.Action icon="tag-multiple-outline" onPress={() => setTagOpen(true)} />
        <Appbar.Content
          title={tag ?? "全部收藏"}
          subtitle={`共 ${total} 项`}
          titleStyle={styles.headerTitle}
        />
        <Appbar.Action icon="magnify" onPress={() => navigation.navigate("Search")} />
        <Appbar.Action icon="cog-outline" onPress={() => navigation.navigate("Settings")} />
      </Appbar.Header>

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: theme.colors.error }}>{error}</Text>
          <Button onPress={() => void refresh()}>重试</Button>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text variant="headlineSmall">{filtered ? "没有匹配的收藏" : "还没有收藏"}</Text>
          <HelperText type="info" visible>
            {filtered
              ? "试试更换关键词或标签"
              : "用右下角按钮添加文本、链接或文件，也可以从其他应用分享进来。"}
          </HelperText>
          {!filtered && (
            <View style={styles.emptyActions}>
              <Button mode="contained" onPress={() => setTextOpen(true)}>
                添加文本
              </Button>
              <Button mode="outlined" onPress={() => void pickFiles()}>
                添加文件
              </Button>
            </View>
          )}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 110 }]}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={() => void refresh()} />
          }
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => (
            <ItemCard
              item={item}
              selected={selected.includes(item.id)}
              selectionMode={selectionMode}
              onPress={onCardPress}
              onToggleSelect={toggleSelect}
              onAction={handleAction}
            />
          )}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={styles.footer} />
            ) : items.length >= total ? (
              <Chip compact style={styles.footerChip}>
                共 {total} 项
              </Chip>
            ) : null
          }
        />
      )}

      {!selectionMode && (
        <FAB.Group
          open={fabOpen}
          visible
          icon={fabOpen ? "close" : "plus"}
          actions={[
            {
              icon: "text-box-plus-outline",
              label: "添加文本",
              onPress: () => setTextOpen(true),
            },
            {
              icon: "link-plus",
              label: "添加链接",
              onPress: () => setUrlOpen(true),
            },
            {
              icon: "file-plus-outline",
              label: "添加文件",
              onPress: () => void pickFiles(),
            },
          ]}
          onStateChange={({ open }) => setFabOpen(open)}
          style={{ paddingBottom: insets.bottom + 8 }}
        />
      )}

      <SelectionBar
        count={selected.length}
        onSelectAll={selectAll}
        onClear={clearSelection}
        onTag={() => {
          setTagIds(selected);
          setTagInitial(undefined);
        }}
        onDelete={() =>
          confirmDelete(items.filter((item) => selected.includes(item.id)))
        }
      />

      <TagSheet visible={tagOpen} onDismiss={() => setTagOpen(false)} />
      <TextDialog
        visible={textOpen}
        item={null}
        onDismiss={() => setTextOpen(false)}
      />
      <UrlDialog visible={urlOpen} onDismiss={() => setUrlOpen(false)} />
      <RenameDialog item={renameItem} onDismiss={() => setRenameItem(null)} />
      <TagDialog
        ids={tagIds}
        initialTag={tagInitial}
        onDismiss={() => {
          setTagIds([]);
          setTagInitial(undefined);
        }}
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
        onDelete={(item) => confirmDelete([item])}
        onRename={(item) => {
          setDetailItem(null);
          setRenameItem(item);
        }}
        onTag={(item) => {
          setDetailItem(null);
          setTagIds([item.id]);
          setTagInitial(item.tag);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { paddingHorizontal: 6, paddingTop: 6 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  emptyActions: { flexDirection: "row", gap: 12, marginTop: 12 },
  headerTitle: { fontSize: 20 },
  footer: { marginVertical: 20 },
  footerChip: { alignSelf: "center", marginVertical: 20 },
});
