import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import {
  Card,
  Checkbox,
  Chip,
  IconButton,
  Menu,
  Text,
  useTheme,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ItemView } from "@collect/core";
import { getVideoThumbnail } from "../media/thumbnails";

export type CardAction =
  | "open"
  | "rename"
  | "tag"
  | "copy"
  | "share"
  | "delete";

interface Props {
  item: ItemView;
  selected: boolean;
  selectionMode: boolean;
  onPress: (item: ItemView) => void;
  onToggleSelect: (id: string) => void;
  onAction: (action: CardAction, item: ItemView) => void;
}

function hostOf(value: string): string {
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}

function iconFor(item: ItemView): keyof typeof MaterialCommunityIcons.glyphMap {
  switch (item.type) {
    case "url":
      return "link-variant";
    case "text":
      return "text-box-outline";
    case "image":
      return "image-outline";
    case "video":
      return "play-circle-outline";
    default:
      return "file-outline";
  }
}

export function ItemCard({
  item,
  selected,
  selectionMode,
  onPress,
  onToggleSelect,
  onAction,
}: Props): JSX.Element {
  const theme = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [thumb, setThumb] = useState<string | null>(item.thumbnailUrl);

  useEffect(() => {
    let alive = true;
    if (item.type !== "video" || item.mediaMissing) {
      setThumb(null);
      return;
    }
    void getVideoThumbnail(item).then((uri) => {
      if (alive) setThumb(uri);
    });
    return () => {
      alive = false;
    };
  }, [item.id, item.type, item.mediaMissing]);

  const media = (): JSX.Element => {
    if (item.type === "image" && item.mediaUrl) {
      return (
        <Image
          source={{ uri: item.mediaUrl }}
          style={styles.fill}
          contentFit="cover"
          transition={150}
        />
      );
    }

    if (item.type === "video" && thumb) {
      return (
        <View style={styles.fill}>
          <Image source={{ uri: thumb }} style={styles.fill} contentFit="cover" />
          <View style={styles.playBadge}>
            <MaterialCommunityIcons name="play" size={30} color="#fff" />
          </View>
        </View>
      );
    }

    if (item.type === "text") {
      return (
        <View style={[styles.fill, styles.textArea]}>
          <Text variant="bodySmall" numberOfLines={7} style={{ color: theme.colors.onSurfaceVariant }}>
            {item.content}
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.fill, styles.iconArea, { backgroundColor: theme.colors.surfaceVariant }]}>
        <MaterialCommunityIcons
          name={iconFor(item)}
          size={42}
          color={theme.colors.primary}
        />
        <Text variant="labelSmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
          {item.type === "url" ? hostOf(item.content) : item.extension || "文件"}
        </Text>
        {item.type === "video" && (
          <View style={styles.playBadge}>
            <MaterialCommunityIcons name="play" size={30} color="#fff" />
          </View>
        )}
      </View>
    );
  };

  return (
    <Card
      mode="outlined"
      style={[
        styles.card,
        selected && { borderColor: theme.colors.primary, borderWidth: 2 },
      ]}
      onPress={() => onPress(item)}
      onLongPress={() => onToggleSelect(item.id)}
    >
      <View style={styles.cover}>
        {media()}
        <View style={styles.checkbox}>
          <Checkbox
            status={selected ? "checked" : "unchecked"}
            onPress={() => onToggleSelect(item.id)}
          />
        </View>
        <View style={styles.more}>
          <Menu
            visible={menuOpen}
            onDismiss={() => setMenuOpen(false)}
            anchor={
              <IconButton
                icon="dots-vertical"
                size={18}
                onPress={() => setMenuOpen(true)}
                accessibilityLabel="更多操作"
              />
            }
          >
            <Menu.Item
              leadingIcon="eye-outline"
              title="预览 / 打开"
              onPress={() => {
                setMenuOpen(false);
                onAction("open", item);
              }}
            />
            <Menu.Item
              leadingIcon="pencil-outline"
              title="重命名"
              onPress={() => {
                setMenuOpen(false);
                onAction("rename", item);
              }}
            />
            <Menu.Item
              leadingIcon="tag-outline"
              title="修改标签"
              onPress={() => {
                setMenuOpen(false);
                onAction("tag", item);
              }}
            />
            <Menu.Item
              leadingIcon="content-copy"
              title="复制内容"
              onPress={() => {
                setMenuOpen(false);
                onAction("copy", item);
              }}
            />
            <Menu.Item
              leadingIcon="share-variant-outline"
              title="分享"
              onPress={() => {
                setMenuOpen(false);
                onAction("share", item);
              }}
            />
            <Menu.Item
              leadingIcon="delete-outline"
              title="删除"
              onPress={() => {
                setMenuOpen(false);
                onAction("delete", item);
              }}
            />
          </Menu>
        </View>
        {item.mediaMissing && (
          <Chip compact style={styles.missing} textStyle={{ color: "#fff" }}>
            文件缺失
          </Chip>
        )}
      </View>

      <Card.Content style={styles.meta}>
        <Text variant="titleSmall" numberOfLines={1}>
          {item.title}
        </Text>
        <View style={styles.metaRow}>
          <Chip compact icon="tag-outline" style={styles.tag}>
            {item.tag}
          </Chip>
          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {new Date(item.createdAt).toLocaleDateString("zh-CN")}
          </Text>
        </View>
      </Card.Content>

      {selectionMode && !selected && (
        <View pointerEvents="none" style={styles.selectionShade} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { margin: 6, overflow: "hidden", flex: 1 },
  cover: { aspectRatio: 1, backgroundColor: "#00000010" },
  fill: { width: "100%", height: "100%" },
  textArea: { padding: 12, paddingTop: 34 },
  iconArea: { alignItems: "center", justifyContent: "center", gap: 6, padding: 12 },
  playBadge: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 48,
    height: 48,
    marginTop: -24,
    marginLeft: -24,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkbox: {
    position: "absolute",
    top: 2,
    left: 2,
    borderRadius: 20,
    backgroundColor: "#ffffffcc",
  },
  more: { position: "absolute", top: 2, right: 2, backgroundColor: "#ffffffcc" },
  missing: { position: "absolute", left: 8, bottom: 8, backgroundColor: "#b3261e" },
  meta: { paddingTop: 8, paddingBottom: 10, gap: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tag: { height: 24 },
  selectionShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
});
