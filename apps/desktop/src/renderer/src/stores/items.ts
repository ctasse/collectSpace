import { create } from "zustand";
import type { ContentType, ItemView, TagCount } from "@collect/core";
import type {
  CreateTextInput,
  CreateUrlInput,
  ImportPathsResult,
  UpdateTextInput,
} from "../../../shared/ipc";

const PAGE_SIZE = 200;

let requestSeq = 0;
let queryTimer: number | null = null;

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
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
  selectRange: (fromId: string, toId: string) => void;
  selectAll: () => void;
  clearSelection: () => void;

  createText: (input: CreateTextInput) => Promise<ItemView>;
  createUrl: (input: CreateUrlInput) => Promise<ItemView>;
  updateText: (input: UpdateTextInput) => Promise<ItemView>;
  rename: (id: string, title: string) => Promise<ItemView>;
  importPaths: (paths: string[], tag?: string) => Promise<ImportPathsResult>;
  createFromClipboardImage: (tag?: string) => Promise<ItemView>;
  setTag: (ids: string[], tag: string) => Promise<number>;
  remove: (ids: string[]) => Promise<{ removed: number; fileErrors: string[] }>;
  clearError: () => void;
}

export const useItemsStore = create<ItemsState>((set, get) => {
  const refresh = async (): Promise<void> => {
    const { query, tag, type } = get();
    const seq = ++requestSeq;
    set({ loading: true, error: null });
    try {
      const result = await window.api.items.list({
        query: query.trim() || undefined,
        tag: tag ?? undefined,
        type: type ?? undefined,
        limit: PAGE_SIZE,
      });
      if (seq !== requestSeq) return;
      set({ items: result.items, total: result.total, loading: false });
    } catch (error) {
      if (seq !== requestSeq) return;
      set({ loading: false, error: messageOf(error) });
    }
  };

  const fetchTags = async (): Promise<void> => {
    try {
      const tags = await window.api.items.tags();
      set({ tags });
    } catch {
      // 标签栏失败不阻塞主列表
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
      if (state.loading || state.loadingMore) return;
      if (state.items.length >= state.total) return;

      const seq = requestSeq;
      set({ loadingMore: true });
      try {
        const result = await window.api.items.list({
          query: state.query.trim() || undefined,
          tag: state.tag ?? undefined,
          type: state.type ?? undefined,
          offset: state.items.length,
          limit: PAGE_SIZE,
        });
        if (seq !== requestSeq) return;
        set((current) => {
          const known = new Set(current.items.map((item) => item.id));
          const appended = result.items.filter((item) => !known.has(item.id));
          return {
            items: [...current.items, ...appended],
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
      if (queryTimer !== null) window.clearTimeout(queryTimer);
      queryTimer = window.setTimeout(() => {
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
      set((state) => {
        const selected = state.selected.includes(id)
          ? state.selected.filter((value) => value !== id)
          : [...state.selected, id];
        return { selected, anchorId: id };
      });
    },

    selectRange: (fromId, toId) => {
      const ids = get().items.map((item) => item.id);
      const from = ids.indexOf(fromId);
      const to = ids.indexOf(toId);
      if (from < 0 || to < 0) return;
      const range = ids.slice(Math.min(from, to), Math.max(from, to) + 1);
      set((state) => ({
        selected: [...new Set([...state.selected, ...range])],
        anchorId: toId,
      }));
    },

    selectAll: () => {
      set((state) => ({ selected: state.items.map((item) => item.id) }));
    },

    clearSelection: () => set({ selected: [], anchorId: null }),

    createText: async (input) => {
      const item = await window.api.items.createText(input);
      await afterMutation();
      return item;
    },

    createUrl: async (input) => {
      const item = await window.api.items.createUrl(input);
      await afterMutation();
      return item;
    },

    updateText: async (input) => {
      const item = await window.api.items.updateText(input);
      await afterMutation();
      return item;
    },

    rename: async (id, title) => {
      const item = await window.api.items.rename({ id, title });
      await afterMutation();
      return item;
    },

    importPaths: async (paths, tag) => {
      const result = await window.api.items.importPaths({ paths, tag });
      if (result.imported.length > 0) await afterMutation();
      return result;
    },

    createFromClipboardImage: async (tag) => {
      const item = await window.api.items.createFromClipboardImage({ tag });
      await afterMutation();
      return item;
    },

    setTag: async (ids, tag) => {
      const result = await window.api.items.setTag({ ids, tag });
      if (result.updated > 0) await afterMutation();
      return result.updated;
    },

    remove: async (ids) => {
      const result = await window.api.items.remove({ ids });
      set((state) => ({
        selected: state.selected.filter((id) => !ids.includes(id)),
      }));
      if (result.removed > 0) await afterMutation();
      return result;
    },

    clearError: () => set({ error: null }),
  };
});
