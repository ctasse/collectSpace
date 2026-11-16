import { create } from "zustand";
import * as FileSystem from "expo-file-system";
import { randomUUID } from "expo-crypto";
import {
  extensionOf,
  extensionToType,
  fileStem,
  hostOf,
  isMediaType,
  normalizeUrlInput,
  sanitizeFileName,
  type ContentType,
  type ItemView,
  type TagCount,
} from "@collect/core";
import { getDriver } from "../db";
import { toItemView } from "../db/item-view";
import {
  getItem,
  getItemsByIds,
  insertItem,
  listItems,
  listTags,
  removeItems,
  setItemsTag,
  updateItem,
} from "../db/items-repo";
import { deleteFile, fileExists, mediaUri, renameFile, storeFile } from "../media/files";
import { fetchUrlTitle } from "../services/url-title";

const DEFAULT_TAG = "未分类";
const PAGE_SIZE = 100;
let requestSeq = 0;
let queryTimer: ReturnType<typeof setTimeout> | null = null;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function defaultDescription(content: string): string {
  return content.replace(/\s+/g, " ").trim().slice(0, 50);
}

function normalizeTag(tag?: string): string {
  return tag?.trim().slice(0, 40) || DEFAULT_TAG;
}

function typeForFile(fileName: string, mimeType?: string): ContentType {
  const byExt = extensionToType(fileName);
  if (byExt !== "file") return byExt;
  if (mimeType?.startsWith("image/")) return "image";
  if (mimeType?.startsWith("video/")) return "video";
  return "file";
}

export interface ImportFile {
  uri: string;
  fileName: string;
  mimeType?: string;
}

interface ItemsState {
  items: ItemView[];
  total: number;
  tags: TagCount[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  query: string;
  tag: string | null;
  type: ContentType | null;
  selected: string[];
  anchorId: string | null;

  init: () => Promise<void>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  fetchTags: () => Promise<void>;
  setQuery: (query: string) => void;
  setTagFilter: (tag: string | null) => void;
  setTypeFilter: (type: ContentType | null) => void;

  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;

  createText: (input: {
    content: string;
    title?: string;
    description?: string;
    tag?: string;
  }) => Promise<ItemView>;
  createUrl: (input: {
    url: string;
    title?: string;
    tag?: string;
  }) => Promise<ItemView>;
  updateText: (input: {
    id: string;
    title?: string;
    content?: string;
    description?: string;
    tag?: string;
  }) => Promise<ItemView>;
  importFiles: (files: ImportFile[], tag?: string) => Promise<{ imported: number; failed: string[] }>;
  rename: (id: string, title: string) => Promise<ItemView>;
  setTag: (ids: string[], tag: string) => Promise<number>;
  remove: (ids: string[]) => Promise<number>;
  clearError: () => void;
}

export const useItemsStore = create<ItemsState>((set, get) => {
  const refresh = async (): Promise<void> => {
    const { query, tag, type } = get();
    const seq = ++requestSeq;
    set({ loading: true, error: null });
    try {
      const result = listItems(getDriver(), {
        query: query.trim() || undefined,
        tag: tag ?? undefined,
        type: type ?? undefined,
        limit: PAGE_SIZE,
      });
      if (seq !== requestSeq) return;
      set({
        items: result.items.map(toItemView),
        total: result.total,
        loading: false,
      });
    } catch (error) {
      if (seq !== requestSeq) return;
      set({ loading: false, error: messageOf(error) });
    }
  };

  const fetchTags = async (): Promise<void> => {
    try {
      set({ tags: listTags(getDriver()) });
    } catch {
      // 标签失败不阻塞列表
    }
  };

  const afterMutation = async (): Promise<void> => {
    await refresh();
    await fetchTags();
  };

  return {
    items: [],
    total: 0,
    tags: [],
    loading: false,
    loadingMore: false,
    error: null,
    query: "",
    tag: null,
    type: null,
    selected: [],
    anchorId: null,

    init: async () => {
      await Promise.all([refresh(), fetchTags()]);
    },
    refresh,
    fetchTags,

    loadMore: async () => {
      const state = get();
      if (state.loading || state.loadingMore || state.items.length >= state.total) {
        return;
      }
      const seq = requestSeq;
      set({ loadingMore: true });
      try {
        const result = listItems(getDriver(), {
          query: state.query.trim() || undefined,
          tag: state.tag ?? undefined,
          type: state.type ?? undefined,
          offset: state.items.length,
          limit: PAGE_SIZE,
        });
        if (seq !== requestSeq) return;
        set((current) => {
          const known = new Set(current.items.map((item) => item.id));
          return {
            items: [
              ...current.items,
              ...result.items
                .filter((item) => !known.has(item.id))
                .map(toItemView),
            ],
            total: result.total,
            loadingMore: false,
          };
        });
      } catch (error) {
        set({ loadingMore: false, error: messageOf(error) });
      }
    },

    setQuery: (query) => {
      set({ query });
      if (queryTimer) clearTimeout(queryTimer);
      queryTimer = setTimeout(() => {
        queryTimer = null;
        void refresh();
      }, 250);
    },

    setTagFilter: (tag) => {
      set({ tag, selected: [], anchorId: null });
      void refresh();
    },

    setTypeFilter: (type) => {
      set({ type, selected: [], anchorId: null });
      void refresh();
    },

    toggleSelect: (id) => {
      set((state) => ({
        selected: state.selected.includes(id)
          ? state.selected.filter((value) => value !== id)
          : [...state.selected, id],
        anchorId: id,
      }));
    },

    selectAll: () => {
      set((state) => ({
        selected: state.items.map((item) => item.id),
        anchorId: state.items[0]?.id ?? null,
      }));
    },

    clearSelection: () => set({ selected: [], anchorId: null }),

    createText: async (input) => {
      const content = input.content.trim();
      if (!content) throw new Error("内容不能为空");
      const item = insertItem(getDriver(), {
        title: input.title?.trim().slice(0, 300) || "文本收藏",
        content,
        description: input.description?.trim() || defaultDescription(content),
        type: "text",
        tag: normalizeTag(input.tag),
      });
      await afterMutation();
      return toItemView(item);
    },

    createUrl: async (input) => {
      const url = normalizeUrlInput(input.url);
      if (!url) throw new Error("链接格式不正确（仅支持 http/https）");
      let title = input.title?.trim();
      if (!title) {
        try {
          title = (await fetchUrlTitle(url)).title;
        } catch {
          title = hostOf(url);
        }
      }
      const item = insertItem(getDriver(), {
        title: title.slice(0, 300),
        content: url,
        description: "",
        type: "url",
        tag: normalizeTag(input.tag),
      });
      await afterMutation();
      return toItemView(item);
    },

    updateText: async (input) => {
      const existing = getItem(getDriver(), input.id);
      if (!existing) throw new Error("收藏不存在或已被删除");
      if (
        input.content !== undefined &&
        existing.type !== "text" &&
        existing.type !== "url"
      ) {
        throw new Error("媒体收藏不支持修改内容");
      }
      const updated = updateItem(getDriver(), input.id, {
        title: input.title?.trim().slice(0, 300),
        content: input.content,
        description: input.description,
        tag: input.tag === undefined ? undefined : normalizeTag(input.tag),
      });
      if (!updated) throw new Error("收藏不存在或已被删除");
      await afterMutation();
      return toItemView(updated);
    },

    importFiles: async (files, tag) => {
      const failed: string[] = [];
      let imported = 0;

      for (const file of files) {
        let copied: string | null = null;
        try {
          const type = typeForFile(file.fileName, file.mimeType);
          const itemId = randomUUID();
          const stored = await storeFile(file.uri, file.fileName, type, itemId);
          copied = stored.relPath;
          insertItem(getDriver(), {
            id: itemId,
            title: fileStem(file.fileName) || "文件",
            content: stored.relPath,
            type,
            tag: normalizeTag(tag),
            sizeBytes: stored.sizeBytes,
            fileMtime: stored.fileMtime,
          });
          imported += 1;
        } catch (error) {
          if (copied) await deleteFile(copied).catch(() => undefined);
          failed.push(`${file.fileName}：${messageOf(error)}`);
        }
      }

      await afterMutation();
      return { imported, failed };
    },

    rename: async (id, title) => {
      const driver = getDriver();
      const existing = getItem(driver, id);
      if (!existing) throw new Error("收藏不存在或已被删除");
      const nextTitle = title.trim().slice(0, 300);
      if (!nextTitle) throw new Error("标题不能为空");

      if (!isMediaType(existing.type)) {
        const updated = updateItem(driver, id, { title: nextTitle });
        if (!updated) throw new Error("收藏不存在或已被删除");
        await afterMutation();
        return toItemView(updated);
      }

      if (!(await fileExists(existing.content))) {
        throw new Error("原文件缺失，无法重命名");
      }
      const ext = extensionOf(existing.content);
      const fileName = sanitizeFileName(`${fileStem(nextTitle) || "文件"}${ext}`);
      const nextRel = await renameFile(existing.content, fileName);

      let updated;
      try {
        updated = updateItem(driver, id, {
          title: fileStem(fileName),
          content: nextRel,
        });
        if (!updated) throw new Error("收藏不存在或已被删除");
      } catch (error) {
        try {
          await FileSystem.moveAsync({
            from: mediaUri(nextRel),
            to: mediaUri(existing.content),
          });
        } catch {
          // 回滚失败时保留原始错误
        }
        throw error;
      }

      await afterMutation();
      return toItemView(updated);
    },

    setTag: async (ids, tag) => {
      const updated = setItemsTag(getDriver(), ids, normalizeTag(tag));
      if (updated > 0) await afterMutation();
      return updated;
    },

    remove: async (ids) => {
      const driver = getDriver();
      const candidates = getItemsByIds(driver, ids);
      const removed = removeItems(driver, ids);
      for (const item of candidates) {
        if (isMediaType(item.type)) {
          await deleteFile(item.content).catch(() => undefined);
        }
      }
      if (removed > 0) await afterMutation();
      return removed;
    },

    clearError: () => set({ error: null }),
  };
});
