import { contextBridge, ipcRenderer, webUtils } from "electron";
import type {
  AppInfo,
  CreateTextInput,
  CreateUrlInput,
  ImportPathsInput,
  ImportPathsResult,
  ItemListQuery,
  ItemListResult,
  ItemsChangedEvent,
  LegacyInspectResult,
  LegacyProgress,
  LegacySourceInput,
  RelocateInput,
  RemoveInput,
  RemoveResult,
  RenameInput,
  SetTagInput,
  SettingsPatch,
  UpdateTextInput,
} from "../shared/ipc";
import type {
  AppSettings,
  ImportReport,
  ItemView,
  TagCount,
} from "@collect/core";

/** 白名单式暴露 IPC；事件订阅返回取消函数，避免 HMR/重复挂载泄漏。 */
const api = {
  app: {
    info: (): Promise<AppInfo> => ipcRenderer.invoke("app:info"),
    openDataFolder: (): Promise<void> => ipcRenderer.invoke("app:openDataFolder"),
    onOpenPaths: (callback: (paths: string[]) => void): (() => void) => {
      const handler = (_event: unknown, paths: string[]): void => callback(paths);
      ipcRenderer.on("app:openPaths", handler);
      return () => ipcRenderer.removeListener("app:openPaths", handler);
    },
  },

  system: {
    getAccentColor: (): Promise<string | null> =>
      ipcRenderer.invoke("system:getAccentColor"),
    copyText: (text: string): Promise<void> =>
      ipcRenderer.invoke("clipboard:writeText", text),
  },

  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke("settings:get"),
    patch: (patch: SettingsPatch): Promise<AppSettings> =>
      ipcRenderer.invoke("settings:patch", patch),
  },

  dialog: {
    openFiles: (): Promise<string[]> => ipcRenderer.invoke("dialog:openFiles"),
    openDirectory: (): Promise<string | null> =>
      ipcRenderer.invoke("dialog:openDirectory"),
    openLegacyDb: (): Promise<string | null> =>
      ipcRenderer.invoke("dialog:openLegacyDb"),
    openZip: (): Promise<string | null> => ipcRenderer.invoke("dialog:openZip"),
  },

  legacy: {
    inspect: (source: LegacySourceInput): Promise<LegacyInspectResult> =>
      ipcRenderer.invoke("legacy:inspect", source),
    run: (sessionId: string): Promise<ImportReport> =>
      ipcRenderer.invoke("legacy:run", { sessionId }),
    cancel: (sessionId: string): Promise<void> =>
      ipcRenderer.invoke("legacy:cancel", { sessionId }),
    onProgress: (callback: (progress: LegacyProgress) => void): (() => void) => {
      const handler = (_event: unknown, progress: LegacyProgress): void =>
        callback(progress);
      ipcRenderer.on("legacy:progress", handler);
      return () => ipcRenderer.removeListener("legacy:progress", handler);
    },
  },

  url: {
    fetchTitle: (url: string): Promise<{ url: string; title: string }> =>
      ipcRenderer.invoke("url:fetchTitle", { url }),
  },

  media: {
    thumbnail: (id: string): Promise<{ url: string | null; cached: boolean }> =>
      ipcRenderer.invoke("media:thumbnail", { id }),
  },

  files: {
    /** Electron ≥32：从拖拽/粘贴的 File 取真实路径 */
    getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  },

  items: {
    list: (query: ItemListQuery = {}): Promise<ItemListResult> =>
      ipcRenderer.invoke("items:list", query),
    tags: (): Promise<TagCount[]> => ipcRenderer.invoke("items:tags"),
    createText: (input: CreateTextInput): Promise<ItemView> =>
      ipcRenderer.invoke("items:createText", input),
    createUrl: (input: CreateUrlInput): Promise<ItemView> =>
      ipcRenderer.invoke("items:createUrl", input),
    updateText: (input: UpdateTextInput): Promise<ItemView> =>
      ipcRenderer.invoke("items:updateText", input),
    rename: (input: RenameInput): Promise<ItemView> =>
      ipcRenderer.invoke("items:rename", input),
    importPaths: (input: ImportPathsInput): Promise<ImportPathsResult> =>
      ipcRenderer.invoke("items:importPaths", input),
    createFromClipboardImage: (input: { tag?: string } = {}): Promise<ItemView> =>
      ipcRenderer.invoke("items:createFromClipboardImage", input),
    setTag: (input: SetTagInput): Promise<{ updated: number }> =>
      ipcRenderer.invoke("items:setTag", input),
    remove: (input: RemoveInput): Promise<RemoveResult> =>
      ipcRenderer.invoke("items:remove", input),
    relocate: (input: RelocateInput): Promise<ItemView> =>
      ipcRenderer.invoke("items:relocate", input),
    open: (input: { id: string }): Promise<void> =>
      ipcRenderer.invoke("items:open", input),
    showInFolder: (input: { id: string }): Promise<void> =>
      ipcRenderer.invoke("items:showInFolder", input),
    onChanged: (callback: (event: ItemsChangedEvent) => void): (() => void) => {
      const handler = (_event: unknown, payload: ItemsChangedEvent): void =>
        callback(payload);
      ipcRenderer.on("items:changed", handler);
      return () => ipcRenderer.removeListener("items:changed", handler);
    },
  },
};

contextBridge.exposeInMainWorld("api", api);

export type Api = typeof api;
