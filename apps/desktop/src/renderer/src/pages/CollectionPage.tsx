import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Fab,
  LinearProgress,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import type { ItemView } from "@collect/core";
import { useItemsStore } from "../stores/items";
import { useSettingsStore } from "../stores/settings";
import { notify, notifyError, useUiStore } from "../stores/ui";
import { ItemCard } from "../components/ItemCard";
import {
  DeleteDialog,
  ItemDetailDialog,
  RenameDialog,
  TagDialog,
  TextDialog,
  UrlDialog,
} from "../components/Dialogs";
import {
  AddIcon,
  CloseIcon,
  DeleteIcon,
  FileIcon,
  LinkIcon,
  SelectAllIcon,
  TagIcon,
  TextIcon,
} from "../components/icons";

export function CollectionPage(): JSX.Element {
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down("md"));
  const items = useItemsStore((state) => state.items);
  const total = useItemsStore((state) => state.total);
  const tags = useItemsStore((state) => state.tags);
  const loading = useItemsStore((state) => state.loading);
  const loadingMore = useItemsStore((state) => state.loadingMore);
  const error = useItemsStore((state) => state.error);
  const query = useItemsStore((state) => state.query);
  const tag = useItemsStore((state) => state.tag);
  const type = useItemsStore((state) => state.type);
  const selected = useItemsStore((state) => state.selected);
  const init = useItemsStore((state) => state.init);
  const loadMore = useItemsStore((state) => state.loadMore);
  const toggleSelect = useItemsStore((state) => state.toggleSelect);
  const selectRange = useItemsStore((state) => state.selectRange);
  const selectAll = useItemsStore((state) => state.selectAll);
  const clearSelection = useItemsStore((state) => state.clearSelection);
  const setTagFilter = useItemsStore((state) => state.setTagFilter);
  const setTypeFilter = useItemsStore((state) => state.setTypeFilter);
  const setQuery = useItemsStore((state) => state.setQuery);
  const clearError = useItemsStore((state) => state.clearError);
  const importPaths = useItemsStore((state) => state.importPaths);
  const createText = useItemsStore((state) => state.createText);
  const createUrl = useItemsStore((state) => state.createUrl);
  const createFromClipboardImage = useItemsStore(
    (state) => state.createFromClipboardImage,
  );

  const gridColumns = useSettingsStore((state) => state.settings.gridColumns);
  const openLegacy = useUiStore((state) => state.openLegacy);
  const [dragging, setDragging] = useState(false);

  const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null);
  const [textOpen, setTextOpen] = useState(false);
  const [textItem, setTextItem] = useState<ItemView | null>(null);
  const [urlOpen, setUrlOpen] = useState(false);
  const [renameItem, setRenameItem] = useState<ItemView | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [deleteItems, setDeleteItems] = useState<ItemView[]>([]);
  const [previewItem, setPreviewItem] = useState<ItemView | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "400px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, items.length, total]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable === true;
      if (typing) return;

      if (event.key === "Escape" && selected.length > 0) {
        clearSelection();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        selectAll();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected.length, clearSelection, selectAll]);

  const selectedItems = useMemo(
    () => items.filter((item) => selected.includes(item.id)),
    [items, selected],
  );

  const handleCardClick = (event: ReactMouseEvent, item: ItemView): void => {
    if (event.ctrlKey || event.metaKey) {
      toggleSelect(item.id);
      return;
    }
    if (event.shiftKey) {
      const anchor = useItemsStore.getState().anchorId;
      if (anchor) {
        selectRange(anchor, item.id);
        return;
      }
    }
    if (selected.length > 0) {
      toggleSelect(item.id);
      return;
    }
    setPreviewItem(item);
  };

  const importMany = useCallback(
    async (paths: string[]): Promise<void> => {
      if (paths.length === 0) return;

      // .db/.zip 更可能是旧数据备份：转到导入向导，而不是当普通收藏
      const legacy = paths.filter((path) => /\.(db|sqlite|sqlite3|zip)$/i.test(path));
      const normal = paths.filter((path) => !legacy.includes(path));

      if (legacy.length > 0) {
        const first = legacy[0];
        if (first) {
          openLegacy(
            /\.zip$/i.test(first) ? { zipPath: first } : { dbPath: first },
          );
        }
        if (legacy.length > 1) {
          notify("一次只能预检一个数据库或 ZIP，其余已忽略", "warning");
        }
      }
      if (normal.length === 0) return;

      try {
        const result = await importPaths(normal);
        if (result.imported.length > 0) {
          notify(`已导入 ${result.imported.length} 个文件`, "success");
        }
        if (result.failed.length > 0) {
          notify(
            `${result.failed.length} 个文件导入失败：${result.failed[0]?.error ?? ""}`,
            "warning",
          );
        }
      } catch (errorValue) {
        notifyError(errorValue);
      }
    },
    [importPaths, openLegacy],
  );

  const addFiles = async (): Promise<void> => {
    setAddAnchor(null);
    try {
      const paths = await window.api.dialog.openFiles();
      await importMany(paths);
    } catch (errorValue) {
      notifyError(errorValue);
    }
  };

  // 拖拽文件/文件夹到窗口
  useEffect(() => {
    let depth = 0;
    const hasFiles = (event: DragEvent): boolean =>
      Array.from(event.dataTransfer?.types ?? []).includes("Files");

    const onDragEnter = (event: DragEvent): void => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth += 1;
      setDragging(true);
    };
    const onDragOver = (event: DragEvent): void => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };
    const onDragLeave = (event: DragEvent): void => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (event: DragEvent): void => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      const files = Array.from(event.dataTransfer?.files ?? []);
      const paths = files
        .map((file) => window.api.files.getPathForFile(file))
        .filter(Boolean);
      void importMany(paths);
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [importMany]);

  // 无输入焦点时 Ctrl+V：文件 / 剪贴板图片 / 链接 / 文本
  useEffect(() => {
    const onPaste = (event: ClipboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable === true;
      if (typing) return;

      const data = event.clipboardData;
      if (!data) return;

      const files = Array.from(data.files);
      if (files.length > 0) {
        event.preventDefault();
        const paths = files
          .map((file) => window.api.files.getPathForFile(file))
          .filter(Boolean);
        if (paths.length > 0) {
          void importMany(paths);
          return;
        }
        if (files.some((file) => file.type.startsWith("image/"))) {
          void createFromClipboardImage()
            .then(() => notify("已添加剪贴板图片", "success"))
            .catch(notifyError);
          return;
        }
      }

      const text = data.getData("text/plain").trim();
      if (!text) return;
      event.preventDefault();

      if (/^https?:\/\/\S+$/i.test(text)) {
        void createUrl({ url: text })
          .then(() => notify("已添加链接收藏", "success"))
          .catch(notifyError);
      } else {
        void createText({ content: text })
          .then(() => notify("已添加文本收藏", "success"))
          .catch(notifyError);
      }
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [importMany, createFromClipboardImage, createText, createUrl]);

  // “用 CollectSpace 打开”传入的文件
  useEffect(() => {
    return window.api.app.onOpenPaths((paths) => {
      void importMany(paths);
    });
  }, [importMany]);

  const copyItem = (item: ItemView): void => {
    window.api.system
      .copyText(item.content)
      .then(() => notify("已复制", "success"))
      .catch(notifyError);
  };

  const relocateItem = async (item: ItemView): Promise<void> => {
    try {
      const paths = await window.api.dialog.openFiles();
      const path = paths[0];
      if (!path) return;
      const updated = await window.api.items.relocate({ id: item.id, path });
      setPreviewItem((current) =>
        current?.id === updated.id ? updated : current,
      );
      await useItemsStore.getState().refresh();
      notify("已重新定位文件", "success");
    } catch (errorValue) {
      notifyError(errorValue);
    }
  };

  const columns = !narrow && gridColumns > 0 ? gridColumns : null;
  const gridStyle = columns
    ? {
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: 2,
      }
    : {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 2,
      };

  const filtered = Boolean(query.trim() || tag || type);

  const clearFilters = (): void => {
    setQuery("");
    setTagFilter(null);
    setTypeFilter(null);
  };

  return (
    <Box>
      {loading && items.length > 0 && <LinearProgress sx={{ mb: 2 }} />}

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={clearError}>
              知道了
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {selected.length > 0 && (
        <Paper
          variant="outlined"
          sx={{
            p: 1,
            mb: 2,
            display: "flex",
            alignItems: "center",
            gap: 1,
            flexWrap: "wrap",
            position: "sticky",
            top: 0,
            zIndex: 2,
            bgcolor: "background.paper",
          }}
        >
          <Typography variant="subtitle2" sx={{ px: 1 }}>
            已选 {selected.length} 项
          </Typography>
          <Button size="small" startIcon={<SelectAllIcon />} onClick={selectAll}>
            全选当前
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            size="small"
            startIcon={<TagIcon />}
            onClick={() => setTagIds(selected)}
          >
            修改标签
          </Button>
          <Button
            size="small"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setDeleteItems(selectedItems)}
          >
            删除
          </Button>
          <Button size="small" startIcon={<CloseIcon />} onClick={clearSelection}>
            取消
          </Button>
        </Paper>
      )}

      {loading && items.length === 0 && (
        <Box sx={{ display: "grid", placeItems: "center", py: 12 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && items.length === 0 && (
        <Box
          sx={{
            minHeight: "60vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            textAlign: "center",
          }}
        >
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: "24px",
              display: "grid",
              placeItems: "center",
              bgcolor: "action.hover",
              color: "text.secondary",
            }}
          >
            {filtered ? <TextIcon sx={{ fontSize: 36 }} /> : <AddIcon sx={{ fontSize: 40 }} />}
          </Box>
          <Typography variant="h6">
            {filtered ? "没有匹配的收藏" : "还没有收藏"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {filtered
              ? "换个关键词、标签或类型试试。"
              : "添加文本、链接，或把文件拖进来开始收藏。"}
          </Typography>
          <Stack direction="row" spacing={1}>
            {filtered ? (
              <Button variant="outlined" onClick={clearFilters}>
                清除筛选
              </Button>
            ) : (
              <>
                <Button variant="contained" onClick={() => setTextOpen(true)}>
                  添加文本
                </Button>
                <Button variant="outlined" onClick={() => setUrlOpen(true)}>
                  添加链接
                </Button>
                <Button variant="outlined" onClick={() => void addFiles()}>
                  添加文件
                </Button>
              </>
            )}
          </Stack>
        </Box>
      )}

      {items.length > 0 && (
        <>
          <Box sx={gridStyle}>
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                selected={selected.includes(item.id)}
                selectionMode={selected.length > 0}
                onClick={handleCardClick}
                onOpen={setPreviewItem}
                onToggleSelect={toggleSelect}
                onRename={setRenameItem}
                onTag={(target) => setTagIds([target.id])}
                onDelete={(target) => setDeleteItems([target])}
                onCopy={copyItem}
                onReveal={(target) => {
                  window.api.items
                    .showInFolder({ id: target.id })
                    .catch(notifyError);
                }}
                onRelocate={(target) => void relocateItem(target)}
              />
            ))}
          </Box>

          <Box ref={sentinelRef} sx={{ py: 4, display: "grid", placeItems: "center" }}>
            {loadingMore ? (
              <CircularProgress size={24} />
            ) : items.length < total ? (
              <Button onClick={() => void loadMore()}>加载更多</Button>
            ) : (
              <Typography variant="caption" color="text.secondary">
                共 {total} 项
              </Typography>
            )}
          </Box>
        </>
      )}

      {dragging && (
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            zIndex: 20,
            bgcolor: "rgba(18,18,18,0.55)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            pointerEvents: "none",
          }}
        >
          <Box
            sx={{
              px: 8,
              py: 6,
              borderRadius: 4,
              border: 2,
              borderStyle: "dashed",
              borderColor: "primary.main",
              bgcolor: "background.paper",
              textAlign: "center",
            }}
          >
            <AddIcon sx={{ fontSize: 56, color: "primary.main" }} />
            <Typography variant="h5" sx={{ mt: 1 }}>
              松开以添加收藏
            </Typography>
            <Typography variant="body2" color="text.secondary">
              支持图片、视频、文件，也可以拖入文件夹
            </Typography>
          </Box>
        </Box>
      )}

      {selected.length === 0 && (
        <Fab
          color="primary"
          aria-label="添加收藏"
          onClick={(event) => setAddAnchor(event.currentTarget)}
          sx={{ position: "fixed", right: 24, bottom: 24, zIndex: 3 }}
        >
          <AddIcon />
        </Fab>
      )}

      <Menu anchorEl={addAnchor} open={Boolean(addAnchor)} onClose={() => setAddAnchor(null)}>
        <MenuItem
          onClick={() => {
            setAddAnchor(null);
            setTextOpen(true);
          }}
        >
          <TextIcon fontSize="small" sx={{ mr: 1 }} />
          添加文本
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAddAnchor(null);
            setUrlOpen(true);
          }}
        >
          <LinkIcon fontSize="small" sx={{ mr: 1 }} />
          添加链接
        </MenuItem>
        <MenuItem onClick={() => void addFiles()}>
          <FileIcon fontSize="small" sx={{ mr: 1 }} />
          添加文件
        </MenuItem>
      </Menu>

      <TextDialog
        open={textOpen || Boolean(textItem)}
        item={textItem}
        onClose={() => {
          setTextOpen(false);
          setTextItem(null);
        }}
      />
      <UrlDialog open={urlOpen} onClose={() => setUrlOpen(false)} />
      <RenameDialog open={Boolean(renameItem)} item={renameItem} onClose={() => setRenameItem(null)} />
      <TagDialog
        open={tagIds.length > 0}
        ids={tagIds}
        initialTag={
          tagIds.length === 1
            ? items.find((item) => item.id === tagIds[0])?.tag
            : undefined
        }
        onClose={() => setTagIds([])}
      />
      <DeleteDialog
        open={deleteItems.length > 0}
        items={deleteItems}
        onClose={() => setDeleteItems([])}
      />

      <ItemDetailDialog
        open={Boolean(previewItem)}
        item={previewItem}
        onClose={() => setPreviewItem(null)}
        onEdit={(target) => {
          setPreviewItem(null);
          setTextItem(target);
        }}
        onRename={(target) => setRenameItem(target)}
        onTag={(target) => setTagIds([target.id])}
        onDelete={(target) => {
          setPreviewItem(null);
          setDeleteItems([target]);
        }}
        onRelocate={(target) => void relocateItem(target)}
      />

      {tags.length === 0 && items.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 3 }}>
          提示：添加收藏时填写标签，就能在左侧按标签筛选。
        </Typography>
      )}
    </Box>
  );
}
