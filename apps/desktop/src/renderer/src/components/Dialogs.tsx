import { useEffect, useRef, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import type { ItemView } from "@collect/core";
import { useItemsStore } from "../stores/items";
import { notify, notifyError } from "../stores/ui";
import {
  DeleteIcon,
  EditIcon,
  FileIcon,
  FolderIcon,
  OpenInNewIcon,
  TagIcon,
  TextIcon,
} from "./icons";

function TagField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}): JSX.Element {
  const tags = useItemsStore((state) => state.tags);
  return (
    <Autocomplete
      freeSolo
      options={tags.map((tag) => tag.name)}
      value={value}
      onInputChange={(_event, next) => onChange(next)}
      renderInput={(params) => (
        <TextField {...params} label="标签" size="small" placeholder="未分类" />
      )}
    />
  );
}

export function TextDialog({
  open,
  item,
  onClose,
}: {
  open: boolean;
  item: ItemView | null;
  onClose: () => void;
}): JSX.Element {
  const createText = useItemsStore((state) => state.createText);
  const updateText = useItemsStore((state) => state.updateText);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tag, setTag] = useState("未分类");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(item?.title ?? "");
    setContent(item?.content ?? "");
    setTag(item?.tag ?? "未分类");
  }, [open, item]);

  const submit = async (): Promise<void> => {
    const text = content.trim();
    if (!text) return;
    setBusy(true);
    try {
      if (item) {
        await updateText({
          id: item.id,
          title: title.trim() || undefined,
          content: text,
          tag,
        });
      } else {
        await createText({
          title: title.trim() || undefined,
          content: text,
          tag,
        });
      }
      notify(item ? "已保存" : "已添加文本收藏", "success");
      onClose();
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{item ? "编辑文本" : "添加文本"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            label="标题（可选）"
            size="small"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="留空则显示为“文本收藏”"
          />
          <TextField
            label="内容"
            multiline
            minRows={6}
            maxRows={14}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            autoFocus
          />
          <TagField value={tag} onChange={setTag} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" disabled={busy || !content.trim()} onClick={() => void submit()}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function UrlDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): JSX.Element {
  const createUrl = useItemsStore((state) => state.createUrl);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("未分类");
  const [busy, setBusy] = useState(false);
  const [fetchingTitle, setFetchingTitle] = useState(false);
  const fetchedRef = useRef("");

  useEffect(() => {
    if (open) {
      setUrl("");
      setTitle("");
      setTag("未分类");
      fetchedRef.current = "";
    }
  }, [open]);

  const fillTitle = async (): Promise<void> => {
    const value = url.trim();
    if (!value || title.trim() || fetchedRef.current === value) return;
    fetchedRef.current = value;
    setFetchingTitle(true);
    try {
      const result = await window.api.url.fetchTitle(value);
      setTitle((current) => (current.trim() ? current : result.title));
      setUrl(result.url);
    } catch {
      // 抓不到标题时保留空标题，保存时用域名兜底
    } finally {
      setFetchingTitle(false);
    }
  };

  const submit = async (): Promise<void> => {
    if (!url.trim()) return;
    setBusy(true);
    try {
      await createUrl({ url: url.trim(), title: title.trim() || undefined, tag });
      notify("已添加链接收藏", "success");
      onClose();
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>添加链接</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            label="链接"
            size="small"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onBlur={() => void fillTitle()}
            placeholder="https://example.com"
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void fillTitle().then(() => submit());
              }
            }}
          />
          <TextField
            label="标题（可选）"
            size="small"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="留空则使用域名"
            helperText={fetchingTitle ? "正在获取网页标题…" : undefined}
          />
          <TagField value={tag} onChange={setTag} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" disabled={busy || !url.trim()} onClick={() => void submit()}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function RenameDialog({
  open,
  item,
  onClose,
}: {
  open: boolean;
  item: ItemView | null;
  onClose: () => void;
}): JSX.Element {
  const rename = useItemsStore((state) => state.rename);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setTitle(item?.title ?? "");
  }, [open, item]);

  const submit = async (): Promise<void> => {
    if (!item || !title.trim()) return;
    setBusy(true);
    try {
      await rename(item.id, title.trim());
      notify("已重命名", "success");
      onClose();
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>重命名</DialogTitle>
      <DialogContent dividers>
        <TextField
          label="名称"
          size="small"
          fullWidth
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void submit();
          }}
          helperText={item && item.type !== "text" && item.type !== "url" ? "媒体文件会同步重命名" : undefined}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" disabled={busy || !title.trim()} onClick={() => void submit()}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function TagDialog({
  open,
  ids,
  initialTag,
  onClose,
}: {
  open: boolean;
  ids: string[];
  initialTag?: string;
  onClose: () => void;
}): JSX.Element {
  const applyTag = useItemsStore((state) => state.setTag);
  const [tag, setTag] = useState(initialTag ?? "未分类");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setTag(initialTag ?? "未分类");
  }, [open, initialTag]);

  const submit = async (): Promise<void> => {
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const updated = await applyTag(ids, tag.trim() || "未分类");
      notify(`已更新 ${updated} 项标签`, "success");
      onClose();
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>修改标签</DialogTitle>
      <DialogContent dividers>
        <TagField value={tag} onChange={setTag} />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          将应用到 {ids.length} 项收藏
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" disabled={busy} onClick={() => void submit()}>
          应用
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function DeleteDialog({
  open,
  items,
  onClose,
}: {
  open: boolean;
  items: ItemView[];
  onClose: () => void;
}): JSX.Element {
  const remove = useItemsStore((state) => state.remove);
  const [busy, setBusy] = useState(false);

  const confirm = async (): Promise<void> => {
    setBusy(true);
    try {
      const result = await remove(items.map((item) => item.id));
      if (result.fileErrors.length > 0) {
        notify(
          `已删除 ${result.removed} 项，${result.fileErrors.length} 个文件删除失败：${result.fileErrors[0]}`,
          "warning",
        );
      } else {
        notify(`已删除 ${result.removed} 项`, "success");
      }
      onClose();
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  };

  const preview = items.slice(0, 3).map((item) => item.title).join("、");
  const extra = items.length > 3 ? ` 等 ${items.length} 项` : "";

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>删除收藏</DialogTitle>
      <DialogContent>
        <DialogContentText>
          确定删除“{preview}”{extra}吗？媒体文件会按设置移到回收站或永久删除。
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button color="error" variant="contained" disabled={busy} onClick={() => void confirm()}>
          删除
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function ItemDetailDialog({
  open,
  item,
  onClose,
  onEdit,
  onRename,
  onTag,
  onDelete,
  onRelocate,
}: {
  open: boolean;
  item: ItemView | null;
  onClose: () => void;
  onEdit: (item: ItemView) => void;
  onRename: (item: ItemView) => void;
  onTag: (item: ItemView) => void;
  onDelete: (item: ItemView) => void;
  onRelocate: (item: ItemView) => void;
}): JSX.Element | null {
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    setVideoFailed(false);
  }, [item?.id]);

  if (!item) return null;

  const openWithSystem = (): void => {
    window.api.items.open({ id: item.id }).catch(notifyError);
  };

  const copy = (): void => {
    window.api.system
      .copyText(item.content)
      .then(() => notify("已复制", "success"))
      .catch(notifyError);
  };

  const reveal = (): void => {
    window.api.items.showInFolder({ id: item.id }).catch(notifyError);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>{item.title}</DialogTitle>
      <DialogContent dividers>
        {item.type === "image" && item.mediaUrl && (
          <TransformWrapper
            minScale={0.5}
            maxScale={6}
            wheel={{ step: 0.15 }}
            doubleClick={{ mode: "reset" }}
          >
            {({ zoomIn, zoomOut, resetTransform }) => (
              <Box>
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                  <Button size="small" onClick={() => zoomIn()}>
                    放大
                  </Button>
                  <Button size="small" onClick={() => zoomOut()}>
                    缩小
                  </Button>
                  <Button size="small" onClick={() => resetTransform()}>
                    复位
                  </Button>
                </Stack>
                <TransformComponent
                  wrapperStyle={{ width: "100%", height: "62vh", overflow: "hidden" }}
                  contentStyle={{ width: "100%", height: "100%" }}
                >
                  <img
                    src={item.mediaUrl ?? ""}
                    alt={item.title}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "62vh",
                      display: "block",
                      margin: "0 auto",
                      objectFit: "contain",
                    }}
                  />
                </TransformComponent>
              </Box>
            )}
          </TransformWrapper>
        )}

        {item.type === "image" && !item.mediaUrl && (
          <Box sx={{ py: 6, textAlign: "center" }}>
            <Typography color="text.secondary" gutterBottom>
              图片文件缺失
            </Typography>
            <Typography variant="caption" color="text.secondary">
              可以删除该收藏，或稍后使用“重新定位”补齐文件。
            </Typography>
          </Box>
        )}

        {item.type === "video" && item.mediaUrl && !videoFailed && (
          <Box
            component="video"
            src={item.mediaUrl}
            controls
            autoPlay
            onError={() => setVideoFailed(true)}
            sx={{ width: "100%", maxHeight: "62vh", bgcolor: "#000", borderRadius: 2 }}
          />
        )}

        {item.type === "video" && (videoFailed || !item.mediaUrl) && (
          <Box sx={{ py: 6, textAlign: "center" }}>
            <Typography color="text.secondary" gutterBottom>
              当前视频编码无法在应用内播放
            </Typography>
            <Button variant="outlined" onClick={openWithSystem}>
              用系统播放器打开
            </Button>
          </Box>
        )}

        {item.type === "text" && (
          <Typography
            component="pre"
            sx={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontFamily: "inherit",
              m: 0,
              fontSize: 15,
              lineHeight: 1.7,
            }}
          >
            {item.content}
          </Typography>
        )}

        {item.type === "url" && (
          <Stack spacing={1.5}>
            <Typography sx={{ wordBreak: "break-all" }} color="primary">
              {item.content}
            </Typography>
            {item.description && (
              <Typography color="text.secondary">{item.description}</Typography>
            )}
          </Stack>
        )}

        {item.type === "file" && (
          <Stack alignItems="center" spacing={2} sx={{ py: 5 }}>
            <FileIcon sx={{ fontSize: 64 }} color="disabled" />
            <Typography>{item.fileName}</Typography>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={openWithSystem}>
                打开文件
              </Button>
              <Button onClick={reveal}>在文件夹中显示</Button>
            </Stack>
          </Stack>
        )}

        {item.type !== "text" && item.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            {item.description}
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5, flexWrap: "wrap", gap: 0.5 }}>
        {(item.type === "url" || item.type === "image" || item.type === "video" || item.type === "file") && (
          <Button startIcon={<OpenInNewIcon />} onClick={openWithSystem}>
            {item.type === "url" ? "打开链接" : "用系统打开"}
          </Button>
        )}
        {item.type === "text" && (
          <Button startIcon={<EditIcon />} onClick={() => onEdit(item)}>
            编辑
          </Button>
        )}
        {item.mediaMissing && (
          <Button startIcon={<FolderIcon />} onClick={() => onRelocate(item)}>
            重新定位
          </Button>
        )}
        <Button startIcon={<TextIcon />} onClick={copy}>
          复制内容
        </Button>
        <Button startIcon={<TagIcon />} onClick={() => onTag(item)}>
          标签
        </Button>
        <Button startIcon={<EditIcon />} onClick={() => onRename(item)}>
          重命名
        </Button>
        {item.type !== "url" && item.type !== "text" && (
          <Button startIcon={<FolderIcon />} onClick={reveal}>
            所在文件夹
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button color="error" startIcon={<DeleteIcon />} onClick={() => onDelete(item)}>
          删除
        </Button>
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
}
