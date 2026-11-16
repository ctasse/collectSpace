/** 内容类型，与旧 Flutter 版 ContentType 一一对应 */
export type ContentType = "text" | "url" | "image" | "video" | "file";

/** 数据库中的条目（媒体路径为相对 userData/文档目录的路径） */
export interface Item {
  id: string;
  legacyId: number | null;
  legacyUid: string | null;
  title: string;
  content: string;
  description: string;
  type: ContentType;
  tag: string;
  mediaMissing: boolean;
  legacyPath: string | null;
  sizeBytes: number | null;
  fileMtime: number | null;
  sha256: string | null;
  createdAt: number;
  updatedAt: number;
}

/** 交给渲染层/移动端 UI 的条目（URL 由宿主生成） */
export interface ItemView extends Item {
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  fileName: string | null;
  extension: string | null;
}

export type ThemeMode = "system" | "light" | "dark";
export type AccentMode = "system" | "custom";
export type GridColumns = 0 | 2 | 3 | 4 | 5 | 6;

export interface NotificationSettings {
  importDone: boolean;
  errors: boolean;
}

export interface AppSettings {
  themeMode: ThemeMode;
  accentMode: AccentMode;
  customAccent: string;
  gridColumns: GridColumns;
  closeToTray: boolean;
  deleteToTrash: boolean;
  notifications: NotificationSettings;
}

export interface TagCount {
  name: string;
  count: number;
}

/** 桌面旧数据导入的最终报告 */
export interface ImportReport {
  jobId: string;
  startedAt: number;
  finishedAt: number;
  canceled: boolean;
  rows: number;
  inserted: number;
  skippedExisting: number;
  repaired: number;
  mediaRows: number;
  mediaCopied: number;
  mediaMissing: number;
  mediaFailed: number;
  bytesCopied: number;
  ambiguous: number;
  warnings: string[];
  errors: { legacyId: number | null; title: string; reason: string }[];
  logPath: string | null;
}
