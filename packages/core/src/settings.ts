import type {
  AccentMode,
  AppSettings,
  GridColumns,
  ThemeMode,
} from "./types.js";

export const DEFAULT_SETTINGS: AppSettings = {
  themeMode: "system",
  accentMode: "system",
  customAccent: "#6750A4",
  gridColumns: 0,
  closeToTray: false,
  deleteToTrash: true,
  notifications: {
    importDone: true,
    errors: true,
  },
};

const THEME_MODES: readonly ThemeMode[] = ["system", "light", "dark"];
const ACCENT_MODES: readonly AccentMode[] = ["system", "custom"];
const GRID_COLUMNS: readonly GridColumns[] = [0, 2, 3, 4, 5, 6];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function pickGridColumns(value: unknown): GridColumns {
  return typeof value === "number" &&
    (GRID_COLUMNS as readonly number[]).includes(value)
    ? (value as GridColumns)
    : DEFAULT_SETTINGS.gridColumns;
}

function pickAccent(value: unknown): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toUpperCase()
    : DEFAULT_SETTINGS.customAccent;
}

/** 手写归一化（不引 zod），未知字段丢弃、非法值回退默认 */
export function normalizeSettings(input: unknown): AppSettings {
  const src = isRecord(input) ? input : {};
  const notifications = isRecord(src.notifications) ? src.notifications : {};

  return {
    themeMode: pickEnum(src.themeMode, THEME_MODES, DEFAULT_SETTINGS.themeMode),
    accentMode: pickEnum(src.accentMode, ACCENT_MODES, DEFAULT_SETTINGS.accentMode),
    customAccent: pickAccent(src.customAccent),
    gridColumns: pickGridColumns(src.gridColumns),
    closeToTray: pickBoolean(src.closeToTray, DEFAULT_SETTINGS.closeToTray),
    deleteToTrash: pickBoolean(src.deleteToTrash, DEFAULT_SETTINGS.deleteToTrash),
    notifications: {
      importDone: pickBoolean(
        notifications.importDone,
        DEFAULT_SETTINGS.notifications.importDone,
      ),
      errors: pickBoolean(notifications.errors, DEFAULT_SETTINGS.notifications.errors),
    },
  };
}

export function mergeSettings(
  current: AppSettings,
  patch: unknown,
): AppSettings {
  if (!isRecord(patch)) return current;
  return normalizeSettings({ ...current, ...patch });
}
