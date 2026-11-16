import { Linking, StyleSheet, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import * as Sharing from "expo-sharing";
import ImageViewer from "react-native-image-viewing";
import {
  Button,
  Dialog,
  Portal,
  Text,
  useTheme,
} from "react-native-paper";
import type { ItemView } from "@collect/core";
import { notifyError } from "../stores/ui";

export function ImagePreview({
  item,
  onClose,
}: {
  item: ItemView | null;
  onClose: () => void;
}): JSX.Element {
  return (
    <ImageViewer
      images={item?.mediaUrl ? [{ uri: item.mediaUrl }] : []}
      imageIndex={0}
      visible={Boolean(item?.mediaUrl)}
      onRequestClose={onClose}
      swipeToCloseEnabled
      doubleTapToZoomEnabled
    />
  );
}

export function VideoPreview({
  item,
  onClose,
}: {
  item: ItemView;
  onClose: () => void;
}): JSX.Element {
  const theme = useTheme();
  const player = useVideoPlayer(item.mediaUrl ?? "", (instance) => {
    instance.loop = false;
    instance.play();
  });

  return (
    <Portal>
      <Dialog visible onDismiss={onClose} style={styles.videoDialog}>
        <Dialog.Content style={styles.videoContent}>
          <VideoView
            player={player}
            style={[styles.video, { backgroundColor: theme.colors.surfaceVariant }]}
            nativeControls
            contentFit="contain"
          />
          {!item.mediaUrl && (
            <Text style={{ color: theme.colors.error }}>视频文件缺失</Text>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onClose}>关闭</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

export function DetailDialog({
  item,
  onClose,
  onCopy,
  onShare,
  onDelete,
  onRename,
  onTag,
}: {
  item: ItemView | null;
  onClose: () => void;
  onCopy: (item: ItemView) => void;
  onShare: (item: ItemView) => void;
  onDelete: (item: ItemView) => void;
  onRename: (item: ItemView) => void;
  onTag: (item: ItemView) => void;
}): JSX.Element | null {
  const theme = useTheme();
  if (!item) return null;

  const openUrl = (): void => {
    if (item.type !== "url") return;
    Linking.openURL(item.content).catch(notifyError);
  };

  const openFile = (): void => {
    if (!item.mediaUrl) {
      notifyError(new Error("文件缺失"));
      return;
    }
    Sharing.shareAsync(item.mediaUrl, { mimeType: "*/*" }).catch(notifyError);
  };

  return (
    <Portal>
      <Dialog visible onDismiss={onClose} style={styles.detailDialog}>
        <Dialog.Title numberOfLines={2}>{item.title}</Dialog.Title>
        <Dialog.Content style={styles.detailContent}>
          {item.type === "text" && (
            <Text variant="bodyMedium" selectable style={styles.textBody}>
              {item.content}
            </Text>
          )}
          {item.type === "url" && (
            <Text variant="bodyMedium" selectable style={{ color: theme.colors.primary }}>
              {item.content}
            </Text>
          )}
          {item.type === "file" && (
            <View style={styles.fileBox}>
              <Text variant="bodyMedium">{item.fileName}</Text>
              {item.sizeBytes != null && (
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {Math.max(1, Math.round(item.sizeBytes / 1024))} KB
                </Text>
              )}
            </View>
          )}
          {(item.type === "image" || item.type === "video") && item.mediaMissing && (
            <Text style={{ color: theme.colors.error }}>媒体文件缺失，无法预览。</Text>
          )}
          {item.description ? (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {item.description}
            </Text>
          ) : null}
        </Dialog.Content>
        <Dialog.Actions style={styles.actions}>
          {item.type === "url" && <Button onPress={openUrl}>打开链接</Button>}
          {item.type === "file" && <Button onPress={openFile}>用其他应用打开</Button>}
          <Button onPress={() => onCopy(item)}>复制</Button>
          <Button onPress={() => onShare(item)}>分享</Button>
          <Button onPress={() => onTag(item)}>标签</Button>
          <Button onPress={() => onRename(item)}>重命名</Button>
          <Button textColor={theme.colors.error} onPress={() => onDelete(item)}>
            删除
          </Button>
          <Button onPress={onClose}>关闭</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  videoDialog: { maxHeight: "90%" },
  videoContent: { gap: 8 },
  video: { width: "100%", aspectRatio: 16 / 9, borderRadius: 12 },
  detailDialog: { maxHeight: "85%" },
  detailContent: { gap: 12 },
  textBody: { lineHeight: 24 },
  fileBox: { gap: 4, paddingVertical: 12 },
  actions: { flexWrap: "wrap" },
});
