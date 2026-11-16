import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  Dialog,
  HelperText,
  Portal,
  TextInput,
} from "react-native-paper";
import type { ItemView } from "@collect/core";
import { useItemsStore } from "../stores/items";
import { notifyError } from "../stores/ui";
import { fetchUrlTitle } from "../services/url-title";
import { TagField } from "./TagField";

export function TextDialog({
  visible,
  item,
  onDismiss,
}: {
  visible: boolean;
  item: ItemView | null;
  onDismiss: () => void;
}): JSX.Element {
  const createText = useItemsStore((state) => state.createText);
  const updateText = useItemsStore((state) => state.updateText);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tag, setTag] = useState("未分类");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(item?.title ?? "");
    setContent(item?.content ?? "");
    setTag(item?.tag ?? "未分类");
  }, [visible, item]);

  const submit = async (): Promise<void> => {
    if (!content.trim()) return;
    setBusy(true);
    try {
      if (item) {
        await updateText({ id: item.id, title, content, tag });
      } else {
        await createText({ title, content, tag });
      }
      onDismiss();
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{item ? "编辑文本" : "添加文本"}</Dialog.Title>
        <Dialog.Content style={styles.content}>
          <TextInput
            label="标题（可选）"
            value={title}
            onChangeText={setTitle}
            mode="outlined"
          />
          <TextInput
            label="内容"
            value={content}
            onChangeText={setContent}
            mode="outlined"
            multiline
            numberOfLines={6}
            style={styles.multiline}
          />
          <TagField value={tag} onChange={setTag} />
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>取消</Button>
          <Button loading={busy} mode="contained" onPress={() => void submit()}>
            保存
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

export function UrlDialog({
  visible,
  onDismiss,
}: {
  visible: boolean;
  onDismiss: () => void;
}): JSX.Element {
  const createUrl = useItemsStore((state) => state.createUrl);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("未分类");
  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setUrl("");
    setTitle("");
    setTag("未分类");
    setBusy(false);
    setFetching(false);
  }, [visible]);

  const fetchTitle = async (): Promise<void> => {
    if (!url.trim() || title.trim() || fetching) return;
    setFetching(true);
    try {
      const result = await fetchUrlTitle(url);
      setTitle(result.title);
    } catch {
      // 抓取失败时允许用户手动填写或直接保存（后端回退域名）
    } finally {
      setFetching(false);
    }
  };

  const submit = async (): Promise<void> => {
    if (!url.trim()) return;
    setBusy(true);
    try {
      await createUrl({ url, title: title.trim() || undefined, tag });
      onDismiss();
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>添加链接</Dialog.Title>
        <Dialog.Content style={styles.content}>
          <TextInput
            label="链接"
            value={url}
            onChangeText={setUrl}
            onBlur={() => void fetchTitle()}
            autoCapitalize="none"
            keyboardType="url"
            mode="outlined"
            placeholder="https://"
          />
          <TextInput
            label="标题（可选，失焦自动抓取）"
            value={title}
            onChangeText={setTitle}
            mode="outlined"
            right={
              fetching ? <TextInput.Icon icon="loading" disabled /> : undefined
            }
          />
          <TagField value={tag} onChange={setTag} />
          <HelperText type="info" visible>
            抓取失败时会自动使用域名作为标题。
          </HelperText>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>取消</Button>
          <Button loading={busy} mode="contained" onPress={() => void submit()}>
            保存
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

export function RenameDialog({
  item,
  onDismiss,
}: {
  item: ItemView | null;
  onDismiss: () => void;
}): JSX.Element {
  const rename = useItemsStore((state) => state.rename);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTitle(item?.title ?? "");
    setBusy(false);
  }, [item]);

  const submit = async (): Promise<void> => {
    if (!item || !title.trim()) return;
    setBusy(true);
    try {
      await rename(item.id, title);
      onDismiss();
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Portal>
      <Dialog visible={Boolean(item)} onDismiss={onDismiss}>
        <Dialog.Title>重命名</Dialog.Title>
        <Dialog.Content>
          <TextInput
            label="标题"
            value={title}
            onChangeText={setTitle}
            mode="outlined"
            autoFocus
          />
          {item && item.type !== "text" && item.type !== "url" && (
            <HelperText type="info" visible>
              媒体文件会同步改名，扩展名保持不变。
            </HelperText>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>取消</Button>
          <Button loading={busy} mode="contained" onPress={() => void submit()}>
            保存
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

export function TagDialog({
  ids,
  initialTag,
  onDismiss,
}: {
  ids: string[];
  initialTag?: string;
  onDismiss: () => void;
}): JSX.Element {
  const applyTag = useItemsStore((state) => state.setTag);
  const [tag, setTag] = useState(initialTag ?? "未分类");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTag(initialTag ?? "未分类");
    setBusy(false);
  }, [initialTag, ids.join(",")]);

  const submit = async (): Promise<void> => {
    if (ids.length === 0) return;
    setBusy(true);
    try {
      await applyTag(ids, tag);
      onDismiss();
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Portal>
      <Dialog visible={ids.length > 0} onDismiss={onDismiss}>
        <Dialog.Title>{ids.length > 1 ? `修改 ${ids.length} 项标签` : "修改标签"}</Dialog.Title>
        <Dialog.Content style={styles.content}>
          <TagField value={tag} onChange={setTag} />
          <View style={styles.tagHint}>
            <HelperText type="info" visible>
              可直接输入新标签，标签从收藏数据自动汇总。
            </HelperText>
          </View>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>取消</Button>
          <Button loading={busy} mode="contained" onPress={() => void submit()}>
            保存
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  content: { gap: 10 },
  multiline: { minHeight: 120 },
  tagHint: { marginTop: -4 },
});
