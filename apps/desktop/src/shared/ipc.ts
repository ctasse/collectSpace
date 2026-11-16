/** 桌面端 IPC 契约（main / preload / renderer 共用，仅类型）。 */
import type {
  AppSettings,
  ContentType,
  ImportReport,
  ItemView,
  TagCount,
} from "@collect/core";

export interface AppInfo {
  name: string;
  version: string;
  electron: string;
  chrome: string;
  node: string;
  platform: NodeJS.Platform;
  userDataPath: string;
  dbPath: string;
  schemaVersion: number;
  ffmpegAvailable: boolean;
}

export interface ItemListQuery {
  query?: string;
  tag?: string;
  type?: ContentType;
  offset?: number;
  limit?: number;
}

export interface ItemListResult {
  items: ItemView[];
  total: number;
}

export interface CreateTextInput {
  content: string;
  title?: string;
  description?: string;
  tag?: string;
}

export interface CreateUrlInput {
  url: string;
  title?: string;
  description?: string;
  tag?: string;
}

export interface UpdateTextInput {
  id: string;
  title?: string;
  content?: string;
  description?: string;
  tag?: string;
}

export interface SetTagInput {
  ids: string[];
  tag: string;
}

export interface RenameInput {
  id: string;
  title: string;
}

export interface RelocateInput {
  id: string;
  path: string;
}

export interface ImportPathsInput {
  paths: string[];
  tag?: string;
}

export interface ImportPathsResult {
  imported: ItemView[];
  failed: { file: string; error: string }[];
}

export interface RemoveInput {
  ids: string[];
}

export interface RemoveResult {
  removed: number;
  fileErrors: string[];
}

export interface ItemsChangedEvent {
  reason: "create" | "update" | "tag" | "remove";
  ids?: string[];
}

export type SettingsPatch = Partial<Omit<AppSettings, "notifications">> & {
  notifications?: Partial<AppSettings["notifications"]>;
};

export interface LegacySourceInput {
  dbPath?: string;
  mediaDir?: string;
  zipPath?: string;
}

export interface LegacyInspectResult {
  sessionId: string;
  dbLabel: string;
  rows: number;
  types: Record<string, number>;
  mediaRows: number;
  matchedMedia: number;
  missingMedia: number;
  ambiguous: number;
  existing: number;
  warnings: string[];
}

export type LegacyStage =
  | "opening-db"
  | "scanning-media"
  | "matching"
  | "copying"
  | "writing"
  | "done";

export interface LegacyProgress {
  sessionId: string;
  stage: LegacyStage;
  processed: number;
  total: number;
  inserted: number;
  repaired: number;
  missing: number;
}

export type { ImportReport, ItemView, TagCount };
